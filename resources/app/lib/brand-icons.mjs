// Ícones das contas (Epic Games, GOG, RetroAchievements) baixados do próprio site
// de cada serviço na primeira vez e guardados no cache. Nada vem embutido no programa.
import fs from 'node:fs';import path from 'node:path';

// Imagens diretas primeiro (logos oficiais indicados para cada conta), depois o ícone do site.
export const BRAND_DIRECT = {
  epic: ['https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/1920px-Epic_Games_logo.svg.png', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Epic_Games_logo.svg/512px-Epic_Games_logo.svg.png'],
  ra: ['https://static.retroachievements.org/assets/images/favicon.webp']
};
export const BRAND_SITES = {
  epic: ['https://store.epicgames.com/', 'https://www.epicgames.com/'],
  gog: ['https://www.gog.com/'],
  xbox: ['https://www.xbox.com/'],
  psn: ['https://www.playstation.com/'],
  ra: ['https://retroachievements.org/']
};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const MAX = 3 * 1024 * 1024;

export function sniffImage(b) {
  if (!b || b.length < 4) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'image/x-icon';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('ascii', 0, 6) === 'GIF87a' || b.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
  return null; // SVG não é aceito: poderia levar script
}

// <link rel="icon|apple-touch-icon" href sizes> → URLs, maiores primeiro.
export function iconLinks(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0], rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() || '';
    if (!/(^|\s)(icon|apple-touch-icon(-precomposed)?)(\s|$)/.test(rel)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || /\.svg(\?|$)/i.test(href)) continue;
    const sizes = /\bsizes\s*=\s*["']?(\d+)x\d+/i.exec(tag)?.[1];
    let url;try { url = new URL(href.replace(/&amp;/g, '&'), base).href; } catch { continue; }
    if (!/^https:/.test(url)) continue;
    out.push({url, score: (sizes ? Number(sizes) : rel.includes('apple') ? 180 : 32) + (rel.includes('apple') ? 1 : 0)});
  }
  return out.sort((a, b) => b.score - a.score).map(x => x.url);
}

async function get(fetchFn, url, ms = 8000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try { const r = await fetchFn(url, {headers: {'User-Agent': UA, Accept: '*/*'}, signal: c.signal, redirect: 'follow'}); if (!r.ok) return null; const b = Buffer.from(await r.arrayBuffer()); return b.length <= MAX ? {body: b, url: r.url || url} : null; } catch { return null; } finally { clearTimeout(t); }
}

export async function downloadBrandIcon(kind, fetchFn = globalThis.fetch) {
  for (const u of BRAND_DIRECT[kind] || []) { const r = await get(fetchFn, u, 12000); const type = r && sniffImage(r.body); if (type) return {type, body: r.body}; }
  for (const site of BRAND_SITES[kind] || []) {
    const page = await get(fetchFn, site);
    const urls = [...(page ? iconLinks(page.body.toString('utf8'), page.url) : []), new URL('/favicon.ico', site).href];
    for (const u of [...new Set(urls)].slice(0, 6)) { const r = await get(fetchFn, u); const type = r && sniffImage(r.body); if (type) return {type, body: r.body}; }
  }
  return null;
}

// Cache em disco (30 dias); falhas ficam 1 hora sem nova tentativa.
export function brandIcons(cacheDir, fetchFn) {
  const failed = new Map(), pending = new Map();
  return async function icon(kind) {
    if (!BRAND_SITES[kind]) return null;
    const file = path.join(cacheDir, 'brand2-' + kind + '.bin');
    try { const st = fs.statSync(file); const body = fs.readFileSync(file), type = sniffImage(body); if (type && Date.now() - st.mtimeMs < 30 * 86400000) return {type, body}; } catch {}
    if (Date.now() - (failed.get(kind) || 0) < 3600000) { try { const body = fs.readFileSync(file), type = sniffImage(body); if (type) return {type, body}; } catch {} return null; }
    if (!pending.has(kind)) pending.set(kind, downloadBrandIcon(kind, fetchFn).finally(() => pending.delete(kind)));
    const got = await pending.get(kind);
    if (got) { try { fs.mkdirSync(cacheDir, {recursive: true}); fs.writeFileSync(file, got.body); } catch {} return got; }
    failed.set(kind, Date.now());
    try { const body = fs.readFileSync(file), type = sniffImage(body); if (type) return {type, body}; } catch {}
    return null;
  };
}

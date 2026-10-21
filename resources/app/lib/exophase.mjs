// Nomes, descrições, tipo e raridade dos troféus pelo Exophase (site público com a lista de troféus de cada jogo),
// para quando o dump do port traz a lista cifrada. Mesmos endereços e seletores que o SuccessStory (Playnite, MIT)
// usa: busca em api.exophase.com/public/archive/games e a página "endpoint_awards" (ul.trophy > li).
// A lista do site segue a ordem do jogo (platina primeiro), que é a ordem dos IDs dos troféus no dump; ela só é
// usada quando a quantidade bate com a quantidade de troféus do dump.
import path from 'node:path';
import {digest, json, save} from './files.mjs';

const decode = s => String(s || '').replace(/<[^>]*>/g, '').replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[™®©]/g, '').replace(/\bremaster(ed)?\b/g, 'remastered').replace(/[^a-z0-9]+/g, ' ').trim();
const PLATFORM_SLUG = {'PlayStation 4': ['ps4'], 'PlayStation 3': ['ps3'], 'PlayStation Vita': ['vita', 'psvita'], 'PlayStation 5': ['ps5']};

// Lista de troféus de uma página do Exophase. Cada troféu é um <li> com data-average (raridade); o item vai até o
// próximo troféu, o que evita erro com listas aninhadas dentro do item.
export function parseExophaseTrophies(html) {
 const text = String(html || ''), out = [];
 const starts = [...text.matchAll(/<li\b([^>]*\bdata-average=[^>]*)>/gi)];
 const items = starts.length ? starts.map((m, i) => ({attrs: m[1], body: text.slice(m.index + m[0].length, i + 1 < starts.length ? starts[i + 1].index : text.indexOf('</ul>', m.index) > 0 ? text.indexOf('</ul>', m.index) : text.length)}))
  : [...text.matchAll(/<ul\b[^>]*class="[^"]*\b(?:trophy|achievement|challenge)\b[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi)].flatMap(l => [...l[1].matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi)].map(m => ({attrs: m[1], body: m[2]})));
 for (const {attrs, body} of items) {
  const name = decode((body.match(/<div\b[^>]*class="[^"]*award-title[^"]*"[^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i) || body.match(/<a\b[^>]*>((?:(?!<img)[\s\S])*?)<\/a>/i))?.[1]);
  if (!name) continue;
  const description = decode(body.match(/<div\b[^>]*class="[^"]*award-description[^"]*"[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || body.match(/<div\b[^>]*class="[^"]*award-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
   // Outras versões da página: qualquer elemento com "description" na classe, ou o primeiro parágrafo do item.
   || body.match(/<(\w+)\b[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]);
  const icon = body.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1] || '';
  const average = Number((attrs.match(/data-average="([\d.,]+)"/i)?.[1] || '').replace(',', '.'));
  const type = (attrs + ' ' + body).match(/\b(platinum|gold|silver|bronze)\b/i)?.[1]?.toLowerCase() || '';
  out.push({title: name, description, icon: /^https:\/\/m\.exophase\.com\//.test(icon) ? icon : '', globalPercent: Number.isFinite(average) && average > 0 && average <= 100 ? average : null, grade: {platinum: 'P', gold: 'G', silver: 'S', bronze: 'B'}[type] || '', hidden: /\bsecret\b/i.test(attrs)});
 }
 return out;
}

const clean = t => String(t || '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
// Procura o jogo e devolve a lista na ordem do site. request(url) -> JSON; page(url) -> HTML; log(texto) opcional.
export async function exophaseTrophies({title, platform = 'PlayStation 4', count = 0}, {request, page, cacheDir, log = () => {}}) {
 title = clean(title);
 const key = digest(JSON.stringify(['v2', norm(title), platform, count]));
 const file = cacheDir ? path.join(cacheDir, 'exophase-' + key + '.json') : '';
 const cached = file ? json(file, null) : null;
 if (cached && Date.now() - cached.at < (cached.list?.length ? 30 * 86400000 : 10 * 60000)) return cached.list || null;
 // Última lista boa (não expira): usada quando o site não responde, para os troféus não voltarem a "Troféu 1, 2...".
 const good = file ? json(file.replace(/\.json$/, '.good.json'), null)?.list || (cached?.list?.length ? cached.list : null) : null;
 let list = null;
 try {
  const slugs = PLATFORM_SLUG[platform] || [];
  const found = [], queries = [...new Set([title, title.replace(/\s*[:\-–].*$/, ''), title.replace(/\b(remastered|remasterizado|remasterizada|remaster|hd|edition|edição)\b/gi, '').replace(/\s+/g, ' ').trim(), title.split(' ').slice(0, 3).join(' ')])].filter(x => x && x.length > 1);
  for (const q of queries) {
   let r = null; try { r = await request('https://api.exophase.com/public/archive/games?' + new URLSearchParams({q, sort: 'added'})); } catch (e) { log('Exophase: busca "' + q + '" falhou: ' + e.message); continue; }
   for (const g of r?.games?.list || []) if (g?.endpoint_awards && !found.some(f => f.endpoint_awards === g.endpoint_awards)) found.push(g);
   if (found.some(g => !count || Number(g.total_awards) === count)) break;
  }
  const want = norm(title);
  const score = g => (norm(g.title) === want ? 4 : norm(g.title).includes(want) || want.includes(norm(g.title)) ? 2 : 0) + ((g.platforms || []).some(p => slugs.includes(String(p.slug).toLowerCase())) ? 3 : 0) + (count && Number(g.total_awards) === count ? 5 : 0);
  const best = found.filter(g => /^https:\/\/www\.exophase\.com\/game\//.test(g.endpoint_awards) && (!count || Number(g.total_awards) === count)).sort((a, b) => score(b) - score(a))[0];
  if (!best) { log('Exophase: nenhum jogo com ' + count + ' troféus para "' + title + '" (' + found.map(g => g.title + '/' + g.total_awards).slice(0, 6).join(', ') + ').'); }
  else {
   const html = await page(best.endpoint_awards);
   const parsed = parseExophaseTrophies(html);
   if (parsed.length && (!count || parsed.length === count)) { list = parsed; log('Exophase: ' + parsed.length + ' troféus de ' + best.title + '.'); }
   else log('Exophase: página de ' + best.title + ' lida com ' + parsed.length + ' troféus (esperado ' + count + '; ' + String(html || '').length + ' bytes).');
  }
 } catch (e) { log('Exophase: ' + e.message); return good; }
 if (!list) { if (good) log('Exophase: usando a lista salva (' + good.length + ' troféus).'); if (file) save(file, {at: Date.now(), list: good}); return good; }
 if (file) { save(file, {at: Date.now(), list}); save(file.replace(/\.json$/, '.good.json'), {at: Date.now(), list}); }
 return list;
}

// Bancos de dumps verificados (Redump e No-Intro) publicados pelo projeto libretro-database.
// São baixados sob demanda, por plataforma, e guardados em cache local por 30 dias.
// Permitem identificar o jogo exato por serial, CRC/MD5 ou tamanho, sem chave de API.
import fs from 'node:fs';
import path from 'node:path';
import {json, save} from './files.mjs';
import {parseRomName, normalizeSerial} from './rom-name.mjs';
import {normalizeTitle, similarity} from './title-match.mjs';

export const DAT_BASE = 'https://raw.githubusercontent.com/libretro/libretro-database/master/metadat/';
const TTL = 30 * 86400000, FAIL_TTL = 6 * 3600000, VERSION = 2;
const serialKey = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Mapas sem protótipo: títulos como "Constructor" não podem colidir com Object.prototype.
const dict = () => Object.create(null);
const own = (obj, key) => obj && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;

// Interpreta o formato clrmamepro usado pelo libretro-database.
export function parseDat(text) {
 const games = [];
 const re = /\bgame\s*\(([\s\S]*?)\n\)/g;
 let m;
 while ((m = re.exec(text))) {
  const body = m[1];
  const field = (src, key) => src.match(new RegExp('(?:^|\\s)' + key + '\\s+"((?:[^"\\\\]|\\\\.)*)"'))?.[1] ?? src.match(new RegExp('(?:^|\\s)' + key + '\\s+([^\\s)]+)'))?.[1] ?? '';
  const name = field(body, 'name') || field(body, 'comment');
  if (!name) continue;
  const roms = [...body.matchAll(/\brom\s*\(([\s\S]*?)\)\s*(?:\n|$)/g)].map(r => r[1]);
  const first = roms[0] || '';
  const serials = new Set([field(body, 'serial'), ...roms.map(r => field(r, 'serial'))].filter(Boolean).flatMap(s => s.split(/[,\s]+/)).map(serialKey).filter(Boolean));
  games.push({name, region: field(body, 'region'), serials: [...serials], size: Number(field(first, 'size')) || 0, crc: field(first, 'crc').toUpperCase(), md5: field(first, 'md5').toLowerCase(), roms: roms.length});
 }
 return games;
}
export function buildIndex(games) {
 const bySerial = dict(), byCrc = dict(), byMd5 = dict(), bySize = dict(), byTitle = dict();
 games.forEach((g, i) => {
  for (const s of g.serials) (bySerial[s] ||= []).push(i);
  if (g.crc) (byCrc[g.crc] ||= []).push(i);
  if (g.md5) byMd5[g.md5] = i;
  if (g.size && g.roms === 1) (bySize[g.size] ||= []).push(i);
  const t = normalizeTitle(parseRomName(g.name + '.x').title);
  if (t) (byTitle[t] ||= []).push(i);
 });
 return {version: VERSION, at: Date.now(), games: games.map(g => [g.name, g.region, g.serials, g.size, g.crc, g.md5]), bySerial, byCrc, byMd5, bySize, byTitle};
}
const expand = (index, i) => { const [name, region, serials, size, crc, md5] = index.games[i]; const parsed = parseRomName(name + '.x'); return {name, region, serials, size, crc, md5, title: parsed.title, regions: parsed.regions, disc: parsed.disc}; };

// Preferência de região quando há várias versões equivalentes: USA > World > Europe > Brasil > Japão.
const REGION_ORDER = ['USA', 'World', 'Europe', 'Brazil', 'Japan', 'Asia', 'Korea'];
const regionRank = e => { const r = (e.regions?.length ? e.regions : [e.region]).map(x => REGION_ORDER.indexOf(x)).filter(x => x >= 0); return r.length ? Math.min(...r) : 99; };

export class DatIndex {
 constructor({dir, fetchText, offline = false}) { Object.assign(this, {dir, fetchText, offline}); this.memory = new Map(); this.pending = new Map(); }
 file(set, system) { return path.join(this.dir, 'cache', 'dat', set + '-' + system.replace(/[^\w.-]+/g, '_') + '.json'); }
 async index(set, system) {
  const key = set + '/' + system;
  if (this.memory.has(key)) return this.memory.get(key);
  if (this.pending.has(key)) return this.pending.get(key);
  const work = (async () => {
   const file = this.file(set, system);
   let cached = null;
   try { cached = json(file, null); } catch {}
   const fresh = cached && cached.version === VERSION && Date.now() - cached.at < (cached.failed ? FAIL_TTL : TTL);
   if (fresh || this.offline) { const value = cached?.failed ? null : cached; this.memory.set(key, value); return value; }
   try {
    const text = await this.fetchText(DAT_BASE + set + '/' + encodeURIComponent(system) + '.dat');
    const index = buildIndex(parseDat(text));
    if (!index.games.length) throw Error('DAT vazio');
    fs.mkdirSync(path.dirname(file), {recursive: true}); save(file, index);
    this.memory.set(key, index); return index;
   } catch (error) {
    if (cached && !cached.failed) { this.memory.set(key, cached); return cached; }
    try { save(file, {version: VERSION, at: Date.now(), failed: true, message: String(error.message || error).slice(0, 200)}); } catch {}
    this.memory.set(key, null); return null;
   }
  })();
  this.pending.set(key, work);
  try { return await work; } finally { this.pending.delete(key); }
 }
 // Retorna a melhor correspondência com o motivo (serial, crc, md5, tamanho ou nome).
 async lookup(platform, {serial = '', crc = '', crcAlt = '', md5 = '', size = 0, title = '', regions = []} = {}) {
  if (!platform?.dat?.length) return null;
  const results = [];
  for (const [set, system] of platform.dat) {
   const index = await this.index(set, system);
   if (!index) continue;
   const add = (ids, by, confidence) => { for (const i of [].concat(ids ?? [])) results.push({...expand(index, i), by, confidence, set, system}); };
   if (md5 && own(index.byMd5, md5.toLowerCase()) !== undefined) add(own(index.byMd5, md5.toLowerCase()), 'md5', 1);
   for (const c of [crc, crcAlt].filter(Boolean)) if (own(index.byCrc, c.toUpperCase())) add(own(index.byCrc, c.toUpperCase()), 'crc', .99);
   const s = serialKey(serial);
   if (s) {
    let ids = own(index.bySerial, s);
    if (!ids) { const prefix = Object.keys(index.bySerial).find(k => k.startsWith(s) && k.length <= s.length + 2); if (prefix) ids = own(index.bySerial, prefix); }
    if (ids) {
     // Mesmo serial com vários dumps: o tamanho exato desempata.
     const list = ids.map(i => expand(index, i)), bySize = size ? list.filter(e => e.size === size) : [];
     for (const e of (bySize.length ? bySize : list)) results.push({...e, by: bySize.length ? 'serial+size' : 'serial', confidence: bySize.length ? .99 : .95, set, system});
    }
   }
   if (!results.length && size && own(index.bySize, size)) {
    const list = own(index.bySize, size).map(i => expand(index, i)).filter(e => !title || similarity(e.title, title) >= .6);
    if (list.length === 1) results.push({...list[0], by: 'size', confidence: .85, set, system});
   }
   if (!results.length && title) {
    const ids = own(index.byTitle, normalizeTitle(title));
    if (ids) add(ids, 'name', .8);
   }
  }
  if (!results.length) return null;
  const wanted = regions.length ? regions : null;
  results.sort((a, b) => b.confidence - a.confidence || (wanted ? (wanted.includes(b.regions[0]) ? 1 : 0) - (wanted.includes(a.regions[0]) ? 1 : 0) : 0) || regionRank(a) - regionRank(b));
  const best = results[0];
  // Títulos diferentes empatados por nome não são decididos automaticamente.
  const distinct = new Set(results.filter(r => r.confidence === best.confidence).map(r => normalizeTitle(r.title)));
  return {...best, ambiguous: distinct.size > 1, alternatives: results.slice(1, 6).map(r => r.name)};
 }
 // Lista de títulos canônicos da plataforma, para sugerir nomes quando não há hash/serial.
 async titles(platform) {
  const out = new Map();
  for (const [set, system] of platform?.dat || []) {
   const index = await this.index(set, system);
   if (!index) continue;
   for (const [key, ids] of Object.entries(index.byTitle)) if (!out.has(key)) out.set(key, expand(index, ids[0]));
  }
  return out;
 }
}
// Nome de arquivo das miniaturas libretro (caracteres especiais viram "_").
export function libretroThumbnailName(name) { return String(name || '').replace(/[&*/:`<>?\\|"]/g, '_'); }
export function libretroThumbnailURL(system, kind, name) {
 return 'https://thumbnails.libretro.com/' + encodeURIComponent(system) + '/' + kind + '/' + encodeURIComponent(libretroThumbnailName(name)) + '.png';
}

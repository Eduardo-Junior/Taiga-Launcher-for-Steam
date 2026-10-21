// Núcleo do backend do NativeGameLink no Taiga Launcher.
// O NativeGameLink for Steam (MIT, David Miranda) roda o backend em Lua dentro do Millennium; aqui as mesmas
// funções foram portadas para Node e ligadas aos dados do Taiga Launcher. Este arquivo reúne o que os módulos
// Lua recebiam por "deps": HTTP, JSON, caches e utilidades de texto/idioma.
import fs from 'node:fs';
import path from 'node:path';

export const USER_AGENT = 'NativeGameLink-for-Steam/2.0.0 (Taiga Launcher)';
const ALLOWED = /^https:\/\/([a-z0-9-]+\.)*(steampowered\.com|steamcommunity\.com|steamstatic\.com|akamaihd\.net|steamusercontent\.com|steamlvlup\.com|steamgriddb\.com|steamcmd\.net|wikidata\.org|youtube\.com|ytimg\.com|igdb\.com|retroachievements\.org|libretro\.com)(\/|$)/i;

// Mesmo contrato do http.get do Millennium: {status, body, headers} ou null.
export async function httpGet(url, {headers = {}, timeout = 15, binary = false, maxBytes = 12 * 1024 * 1024} = {}) {
 if (process.env.TAIGA_OFFLINE === '1' || !ALLOWED.test(String(url))) return null;
 try {
  const res = await fetch(url, {headers: {'User-Agent': USER_AGENT, ...headers}, signal: AbortSignal.timeout(timeout * 1000), redirect: 'follow'});
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) return {status: 413, body: binary ? Buffer.alloc(0) : '', headers: {}};
  return {status: res.status, body: binary ? buf : buf.toString('utf8'), headers: Object.fromEntries(res.headers), url: res.url};
 } catch { return null; }
}

export const trim = v => String(v ?? '').trim();
export const urlEncode = v => encodeURIComponent(String(v ?? '')).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export const htmlUnescape = v => String(v ?? '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
export const stripHtml = v => trim(htmlUnescape(String(v ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')));

const LOCALE_TO_STEAM_LANG = {en: 'english', english: 'english', es: 'spanish', spanish: 'spanish', es_419: 'latam', 'es-419': 'latam', latam: 'latam', fr: 'french', french: 'french', de: 'german', german: 'german', it: 'italian', italian: 'italian', pt: 'portuguese', portuguese: 'portuguese', pt_br: 'brazilian', 'pt-br': 'brazilian', brazilian: 'brazilian', ru: 'russian', russian: 'russian', pl: 'polish', polish: 'polish', tr: 'turkish', turkish: 'turkish', nl: 'dutch', dutch: 'dutch', sv: 'swedish', swedish: 'swedish', da: 'danish', danish: 'danish', fi: 'finnish', finnish: 'finnish', no: 'norwegian', nb: 'norwegian', nn: 'norwegian', norwegian: 'norwegian', hu: 'hungarian', hungarian: 'hungarian', cs: 'czech', czech: 'czech', ro: 'romanian', romanian: 'romanian', bg: 'bulgarian', bulgarian: 'bulgarian', el: 'greek', greek: 'greek', uk: 'ukrainian', ukrainian: 'ukrainian', vi: 'vietnamese', vietnamese: 'vietnamese', th: 'thai', thai: 'thai', ar: 'arabic', arabic: 'arabic', id: 'indonesian', indonesian: 'indonesian', ja: 'japanese', japanese: 'japanese', ko: 'koreana', korean: 'koreana', koreana: 'koreana', zh_cn: 'schinese', 'zh-cn': 'schinese', zh_hans: 'schinese', 'zh-hans': 'schinese', schinese: 'schinese', zh_tw: 'tchinese', 'zh-tw': 'tchinese', zh_hk: 'tchinese', 'zh-hk': 'tchinese', zh_hant: 'tchinese', 'zh-hant': 'tchinese', tchinese: 'tchinese'};
export function safeLanguage(value) {
 const raw = String(value ?? 'english').toLowerCase().replace(/\s+/g, '');
 if (LOCALE_TO_STEAM_LANG[raw]) return LOCALE_TO_STEAM_LANG[raw];
 const clean = raw.replace(/[^\w-]/g, '');
 if (LOCALE_TO_STEAM_LANG[clean]) return LOCALE_TO_STEAM_LANG[clean];
 const base = clean.match(/^[a-z0-9]+/)?.[0];
 if (base && LOCALE_TO_STEAM_LANG[base]) return LOCALE_TO_STEAM_LANG[base];
 return clean || 'english';
}
// Idioma da Steam a partir do idioma do Taiga Launcher.
export const steamLanguageFor = taigaLanguage => ({'pt-BR': 'brazilian', en: 'english', es: 'latam', fr: 'french', de: 'german'})[taigaLanguage] || 'english';

export function normalizeAppIdAndLanguage(first, second) {
 if (first && typeof first === 'object') {
  const appid = String(first.steam_app_id ?? first.appid ?? first.app_id ?? first.id ?? '').match(/\d+/)?.[0] || '';
  return [appid, safeLanguage(first.language ?? first.lang ?? second ?? 'english')];
 }
 let appid = String(first ?? '').match(/\d+/)?.[0] || '', language = String(second ?? 'english');
 if (!appid && /^\d+$/.test(language)) { appid = language.match(/\d+/)[0]; language = String(first ?? 'english'); }
 return [appid, safeLanguage(language)];
}

// Os callables recebem {request_json:"..."} ou o objeto já decodificado.
export function decodeRequest(raw) {
 if (raw && typeof raw === 'object') {
  if (typeof raw.request_json === 'string') { try { const v = JSON.parse(raw.request_json); if (v && typeof v === 'object') return v; } catch {} return {}; }
  if (raw.request_json && typeof raw.request_json === 'object') return raw.request_json;
  return raw;
 }
 try { const v = JSON.parse(String(raw ?? '')); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

export class TtlCache {
 constructor(limit = 64) { this.limit = limit; this.map = new Map(); }
 get(key, ttlSeconds) { const e = this.map.get(key); if (!e) return undefined; if (ttlSeconds && Date.now() - e.time >= ttlSeconds * 1000) { this.map.delete(key); return undefined; } this.map.delete(key); this.map.set(key, e); return e.value; }
 set(key, value) { this.map.delete(key); this.map.set(key, {value, time: Date.now()}); while (this.map.size > this.limit) this.map.delete(this.map.keys().next().value); return value; }
 delete(key) { this.map.delete(key); }
 clear() { this.map.clear(); }
}

export function readJson(file, fallback) { try { const v = JSON.parse(fs.readFileSync(file, 'utf8')); return v && typeof v === 'object' ? v : fallback; } catch { return fallback; } }
export function writeJsonAtomic(file, value) {
 try { fs.mkdirSync(path.dirname(file), {recursive: true}); const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(value)); fs.renameSync(tmp, file); return true; } catch { return false; }
}

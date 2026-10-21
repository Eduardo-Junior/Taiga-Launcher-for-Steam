// Troféus de ports nativos de jogos de console (ex.: SpartanPort, God of War III do PS4 rodando como .exe).
//
// O jogo continua chamando as funções de troféu do console (sceNpTrophyUnlockTrophy). O port não tem PSN, então
// só escreve o desbloqueio na saída do jogo ("Runtime: trophy 12 unlocked"), que o launcher grava em last_run.log.
// O Taiga Launcher:
//  1. acha o dump do jogo (PARAM.SFO perto do .exe ou citado nas configurações do port);
//  2. lê a lista de troféus do próprio dump (arquivo TRP): ícones sempre; nomes, descrições e tipo
//     (bronze/prata/ouro/platina) direto no PS3 e, no PS4, com a chave de troféus que o usuário já tem
//     configurada no shadPS4 (o Taiga Launcher não traz chave nenhuma) ou com os arquivos já extraídos pelo shadPS4;
//  3. acompanha o log enquanto o jogo roda e guarda cada troféu desbloqueado (o log é apagado a cada sessão);
//  4. calcula a platina quando todos os outros troféus estão completos.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {digest, json, save} from './files.mjs';
import {parseTrophyXML} from './rpcs3-achievements.mjs';
import {consoleTitleNear} from './console-port.mjs';
import {shadps4Roots} from './console-trophies.mjs';

const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const list = d => { try { return fs.readdirSync(d, {withFileTypes: true}); } catch { return []; } };

// ── Linhas de log que anunciam um troféu ──
// SpartanPort: "Runtime: trophy 12 unlocked". Os outros cobrem variações comuns de ports e camadas de compatibilidade.
export const PORT_TROPHY_PATTERNS = [
 /\btroph(?:y|ies)\s*(?:id\s*)?[#:=]?\s*(\d{1,3})\s*(?:was\s+|has\s+been\s+)?unlocked\b/i,
 /\bunlock(?:ed|ing)?\s+troph(?:y|ies)\s*(?:id\s*)?[#:=]?\s*(\d{1,3})\b/i,
 /\bUnlockTrophy\b[^\n]*?\btroph(?:y)?_?id\s*[:=]\s*(\d{1,3})\b/i,
];
export function parsePortTrophyLines(text) {
 const ids = [];
 for (const line of String(text).split(/\r?\n/)) for (const re of PORT_TROPHY_PATTERNS) { const m = line.match(re); if (m) { ids.push(Number(m[1])); break; } }
 return ids;
}

// ── Arquivo TRP (pacote de troféus do PS3/PS4/Vita) ──
// Cabeçalho big-endian de 0x60 bytes (magic DCA24D00) seguido de entradas de 0x40: nome[32], posição u64, tamanho u64.
export function readTRP(buf) {
 if (!Buffer.isBuffer(buf) || buf.length < 0x60 || buf.readUInt32BE(0) !== 0xDCA24D00) throw Error('Arquivo de troféus (TRP) inválido.');
 const count = buf.readUInt32BE(0x10), size = buf.readUInt32BE(0x14);
 if (count < 1 || count > 4096 || size < 0x40 || size > 0x100 || 0x60 + count * size > buf.length) throw Error('Índice do arquivo de troféus inválido.');
 const entries = [];
 for (let i = 0; i < count; i++) {
  const at = 0x60 + i * size, name = buf.toString('latin1', at, at + 32).replace(/\0.*$/s, ''), pos = Number(buf.readBigUInt64BE(at + 32)), len = Number(buf.readBigUInt64BE(at + 40));
  if (!name || pos + len > buf.length || !Number.isSafeInteger(pos)) continue;
  entries.push({name, pos, len});
 }
 return entries;
}
const entryData = (buf, e) => buf.subarray(e.pos, e.pos + e.len);
// PS4: TROP*.ESFM é cifrado (AES-128-CBC). Chave do conjunto = AES-CBC(chave de troféus, iv 0, NPWR..._00 com zeros);
// os primeiros 16 bytes da entrada são o IV. Mesmo procedimento do shadPS4 (GPL; implementação própria).
export function decryptESFM(data, trophyKey, npCommId) {
 if (!trophyKey || trophyKey.length !== 16 || data.length < 32) return null;
 const comm = Buffer.alloc(16); Buffer.from(String(npCommId), 'latin1').copy(comm, 0, 0, 16);
 const enc = crypto.createCipheriv('aes-128-cbc', trophyKey, Buffer.alloc(16)); enc.setAutoPadding(false);
 const setKey = Buffer.concat([enc.update(comm), enc.final()]);
 const body = data.subarray(16, 16 + Math.floor((data.length - 16) / 16) * 16);
 const dec = crypto.createDecipheriv('aes-128-cbc', setKey, data.subarray(0, 16)); dec.setAutoPadding(false);
 const out = Buffer.concat([dec.update(body), dec.final()]);
 const end = out.lastIndexOf('>'); const text = out.subarray(0, end + 1);
 return /<trophyconf\b/i.test(text.toString('utf8')) ? text : null;
}

// Chave de troféus do PS4: a do usuário (configurações do Taiga Launcher, ou keys.json/config.toml do shadPS4).
export function findTrophyKey(config = {}, {extraDirs = [], env = process.env} = {}) {
 const hex = v => { const s = String(v || '').trim().replace(/^0x/i, ''); return /^[0-9a-f]{32}$/i.test(s) ? Buffer.from(s, 'hex') : null; };
 const own = hex(config.ps4TrophyKey); if (own) return own;
 const dirs = [...extraDirs, ...shadps4Roots(config, env)];
 if (env.APPDATA) dirs.push(path.join(env.APPDATA, 'shadPS4'));
 for (const d of [...new Set(dirs.filter(Boolean))]) {
  for (const f of [path.join(d, 'keys.json'), path.join(d, 'user', 'keys.json'), path.join(d, 'keys', 'keys.json')]) {
   if (!isFile(f)) continue; const j = json(f, null);
   const k = hex(j?.TrophyKeySet?.ReleaseTrophyKey) || hex(j?.TrophyKey); if (k) return k;
  }
  for (const f of [path.join(d, 'config.toml'), path.join(d, 'user', 'config.toml')]) {
   if (!isFile(f)) continue; try { const m = fs.readFileSync(f, 'utf8').match(/^\s*TrophyKey\s*=\s*["']?([0-9a-fA-F]{32})/m); if (m) return Buffer.from(m[1], 'hex'); } catch {}
  }
 }
 return null;
}

// Pacotes de troféus do dump e o identificador NPWR.
export function portTrophyPacks(dump) {
 const out = [];
 for (const base of [path.join(dump, 'sce_sys'), path.join(dump, 'Sc0')]) for (const sub of ['trophy', 'trophy2']) for (const e of list(path.join(base, sub))) if (e.isFile() && /\.trp$/i.test(e.name)) out.push({file: path.join(base, sub, e.name), kind: 'ps4'});
 for (const e of list(path.join(dump, 'PS3_GAME', 'TROPDIR'))) if (e.isDirectory()) for (const f of list(path.join(dump, 'PS3_GAME', 'TROPDIR', e.name))) if (/\.trp$/i.test(f.name)) out.push({file: path.join(dump, 'PS3_GAME', 'TROPDIR', e.name, f.name), kind: 'ps3', set: e.name});
 return out;
}
export function npCommIds(dump) {
 const out = new Set();
 for (const f of [path.join(dump, 'sce_sys', 'npbind.dat'), path.join(dump, 'Sc0', 'npbind.dat'), path.join(dump, 'sce_sys', 'trophy2', 'npbind.dat')]) {
  try { if (isFile(f) && fs.statSync(f).size < 1024 * 1024) for (const m of fs.readFileSync(f).toString('latin1').matchAll(/NPWR\d{5}_\d{2}/g)) out.add(m[0]); } catch {}
 }
 return [...out];
}

// Arquivo de idioma do PS4/PS3 (TROP_XX): pt-BR 17 (ou 07), en 01, es 20/03, fr 02, de 04.
const LANG_FILES = {'pt-BR': ['17', '07'], en: ['01', '18'], es: ['20', '03'], fr: ['02', '22'], de: ['04']};
const TROPHY_WORD = {'pt-BR': 'Troféu', en: 'Trophy', es: 'Trofeo', fr: 'Trophée', de: 'Trophäe'};
const saveIcon = (dataDir, bytes) => {
 if (!bytes || bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.length > 4 * 1024 * 1024) return '';
 const name = digest(bytes) + '.png', dest = path.join(dataDir, 'art', name);
 try { fs.mkdirSync(path.dirname(dest), {recursive: true}); if (!isFile(dest)) fs.writeFileSync(dest, bytes); } catch { return ''; }
 return '/art/' + name;
};

// Lista de troféus de um port: {set, title, sourceLanguage, detail: 'full'|'icons', achievements:[{id,title,description,grade,hidden,icon}]}.
export function portTrophyDefinitions(port, {config = {}, dataDir, language = 'pt-BR', env = process.env, exeDir = ''} = {}) {
 if (!port?.dump) return null;
 const ids = npCommIds(port.dump), key = findTrophyKey(config, {extraDirs: [exeDir, exeDir && path.join(exeDir, 'user')], env});
 for (const pack of portTrophyPacks(port.dump)) {
  let buf; try { if (fs.statSync(pack.file).size > 64 * 1024 * 1024) continue; buf = fs.readFileSync(pack.file); } catch { continue; }
  let entries; try { entries = readTRP(buf); } catch { continue; }
  const set = pack.set || ids[0] || '';
  const icons = new Map(); for (const e of entries) { const m = e.name.match(/^TROP(\d{3})\.PNG$/i); if (m) icons.set(Number(m[1]), e); }
  // Definições: arquivo no idioma escolhido, senão o padrão.
  const want = [...(LANG_FILES[language] || []).map(n => 'TROP_' + n), 'TROP', 'TROPCONF'];
  let def = null, sourceLanguage = 'en';
  for (const base of want) {
   const e = entries.find(x => x.name.toUpperCase() === base + '.SFM') || entries.find(x => x.name.toUpperCase() === base + '.ESFM');
   if (!e) continue;
   let xml = null;
   if (/\.SFM$/i.test(e.name) && !/\.ESFM$/i.test(e.name)) xml = entryData(buf, e);
   else if (key && set) { try { xml = decryptESFM(entryData(buf, e), key, set); } catch { xml = null; } }
   if (!xml) continue;
   try { def = parseTrophyXML(xml); if (!def.achievements.some(a => a.title)) { def = null; continue; } sourceLanguage = base.startsWith('TROP_') && (LANG_FILES[language] || []).includes(base.slice(5)) ? language : 'en'; break; } catch { def = null; }
  }
  // Sem chave: arquivos que o shadPS4 já extraiu (trophy/<NPWR>/Xml).
  if (!def && set) for (const root of shadps4Roots(config, env)) {
   const folder = path.join(root, 'trophy', set, 'Xml');
   for (const name of [...(LANG_FILES[language] || []).map(n => `TROP_${n}.XML`), 'TROP.XML']) { const f = path.join(folder, name); if (!isFile(f)) continue; try { def = parseTrophyXML(fs.readFileSync(f)); sourceLanguage = name.startsWith('TROP_') ? language : 'en'; break; } catch {} }
   if (def) break;
  }
  if (def) {
   const achievements = def.achievements.map(a => ({...a, icon: icons.has(Number(a.id)) ? saveIcon(dataDir, entryData(buf, icons.get(Number(a.id)))) : ''}));
   return {set, title: def.title || port.title, sourceLanguage, detail: 'full', achievements};
  }
  // Só os ícones: a lista existe (um ícone por troféu), mas nomes e tipos ficam para quando houver a chave.
  if (icons.size) {
   const word = TROPHY_WORD[language] || TROPHY_WORD.en;
   const achievements = [...icons.keys()].sort((a, b) => a - b).map(id => ({id: String(id), title: `${word} ${id + 1}`, description: '', grade: '', hidden: false, icon: saveIcon(dataDir, entryData(buf, icons.get(id)))}));
   return {set, title: port.title, sourceLanguage: language, detail: 'icons', achievements};
  }
 }
 return null;
}

// ── Progresso guardado pelo Taiga Launcher (o port não guarda) ──
export class PortTrophyStore {
 constructor(dir) { this.dir = path.join(dir, 'port-trophies'); }
 file(uuid) { return path.join(this.dir, String(uuid).replace(/[^\w-]/g, '') + '.json'); }
 get(uuid) { const d = json(this.file(uuid), null); return d && typeof d === 'object' && d.unlocked ? d : {unlocked: {}, manual: {}}; }
 // Devolve true quando o troféu é novo.
 record(uuid, id, at = Math.floor(Date.now() / 1000), {manual = false} = {}) {
  const d = this.get(uuid), key = String(Number(id)); if (!/^\d+$/.test(key) || d.unlocked[key]) return false;
  d.unlocked[key] = at; if (manual) (d.manual ||= {})[key] = true; save(this.file(uuid), d); return true;
 }
 remove(uuid, id) { const d = this.get(uuid), key = String(Number(id)); if (!d.unlocked[key]) return false; delete d.unlocked[key]; if (d.manual) delete d.manual[key]; save(this.file(uuid), d); return true; }
}

// Resultado no formato do gerenciador de conquistas.
export function readPortTrophies(game, port, {config = {}, dataDir, store, env = process.env, names = null, namesLanguage = 'en', namesSource = 'Exophase'} = {}) {
 const language = config.language || 'pt-BR';
 const defs = portTrophyDefinitions(port, {config, dataDir, language, env, exeDir: game.path ? path.dirname(game.path) : ''});
 if (!defs) return null;
 // Lista cifrada: nomes, descrições, tipo e raridade vindos de fora (Exophase), na mesma ordem dos IDs.
 let sourceLanguage = defs.sourceLanguage, detail = defs.detail;
 if ((detail === 'icons' || namesSource === 'PlayStation') && Array.isArray(names) && names.length === defs.achievements.length) { defs.achievements = defs.achievements.map((a, i) => ({...a, title: names[i].title || a.title, description: names[i].description || '', grade: names[i].grade || '', hidden: !!names[i].hidden, globalPercent: names[i].globalPercent ?? null})); if (!defs.achievements.some(a => a.grade === 'P') && /^(unlock|obtain|earn|collect)\b.*\ball\b.*\btroph/i.test(names[0]?.description || '')) defs.achievements[0].grade = 'P'; sourceLanguage = namesLanguage; detail = namesSource === 'PlayStation' ? 'psn' : 'online'; }
 const state = store.get(game.uuid || game.id), unlocked = state.unlocked || {};
 const achievements = defs.achievements.map(a => ({id: String(a.id), title: a.title, description: a.description, grade: a.grade, hidden: !!a.hidden, icon: a.icon, globalPercent: a.globalPercent ?? null, unlocked: !!unlocked[String(Number(a.id))], date: unlocked[String(Number(a.id))] || null, manual: !!state.manual?.[String(Number(a.id))]}));
 // Platina: quando todos os outros estão completos (o port não calcula).
 const plat = achievements.find(a => a.grade === 'P');
 if (plat && !plat.unlocked) { const rest = achievements.filter(a => a !== plat); if (rest.length && rest.every(a => a.unlocked)) { plat.unlocked = true; plat.date = Math.max(...rest.map(a => Number(a.date) || 0)) || Math.floor(Date.now() / 1000); store.record(game.uuid || game.id, plat.id, plat.date); } }
 return {status: 'ok', provider: 'port', source: (port.platform || 'Console') + ' · port' + (detail === 'online' ? ' · Exophase' : detail === 'psn' ? ' · PlayStation' : ''), sourceLanguage, progressKnown: true, trophySet: defs.set, detail, achievements};
}

// Arquivos de log de um port: last_run.log (SpartanPort; pasta "user" ou a definida em settings.json) e *.log da pasta.
export function portLogFiles(exe) {
 const dir = path.dirname(exe), out = [], add = f => { if (f && !out.includes(f)) out.push(f); };
 for (const cfg of [path.join(dir, 'settings.json'), path.join(dir, 'user', 'settings.json')]) { const j = json(cfg, null); if (j?.user_dir) add(path.join(String(j.user_dir), 'last_run.log')); }
 add(path.join(dir, 'user', 'last_run.log')); add(path.join(dir, 'last_run.log'));
 for (const d of [dir, path.join(dir, 'user'), path.join(dir, 'logs'), path.join(dir, 'log')]) for (const e of list(d).slice(0, 200)) if (e.isFile() && /\.(log|txt)$/i.test(e.name) && /log|run|output|console/i.test(e.name)) add(path.join(d, e.name));
 return out.slice(0, 12);
}

// Acompanha os logs dos ports. onUnlock(game, trophyId, {live}), live=false para linhas antigas (o jogo rodou com
// o Taiga Launcher fechado): o troféu entra no progresso sem notificação.
export class PortLogWatcher {
 constructor({games, onUnlock, interval = 1500}) { Object.assign(this, {games, onUnlock, interval}); this.offsets = new Map(); this.timer = null; this.startedAt = Date.now(); }
 start() { if (this.timer) return; this.timer = setInterval(() => this.tick(), this.interval); this.timer.unref?.(); this.tick(); }
 stop() { clearInterval(this.timer); this.timer = null; }
 tick() {
  let pairs = []; try { pairs = this.games(); } catch {}
  for (const {game, file} of pairs) {
   let st; try { st = fs.statSync(file); } catch { continue; }
   const known = this.offsets.get(file);
   let from = known?.offset ?? 0;
   // O launcher recria o log a cada sessão: arquivo menor ou mais novo que o lido = começa do início.
   const head = (() => { try { const fd = fs.openSync(file, 'r'); try { const b = Buffer.alloc(Math.min(256, st.size)); fs.readSync(fd, b, 0, b.length, 0); return digest(b); } finally { fs.closeSync(fd); } } catch { return ''; } })();
   if (known && (st.size < known.offset || st.birthtimeMs > known.birth + 1 || (known.head && st.size >= 256 && known.head !== head))) from = 0;
   if (known && from === st.size && st.mtimeMs === known.mtime) continue;
   const live = st.mtimeMs >= this.startedAt - 5000;
   if (st.size > from) {
    let text = '';
    try { const fd = fs.openSync(file, 'r'); try { const len = Math.min(st.size - from, 4 * 1024 * 1024), b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, Math.max(from, st.size - len)); text = b.toString('utf8'); } finally { fs.closeSync(fd); } } catch { continue; }
    // Só linhas completas.
    const cut = text.lastIndexOf('\n'); if (cut < 0 && st.size - from < 4096) { this.offsets.set(file, {offset: from, mtime: st.mtimeMs, birth: st.birthtimeMs, head: st.size >= 256 ? head : ''}); continue; }
    const usable = cut >= 0 ? text.slice(0, cut + 1) : text;
    for (const id of parsePortTrophyLines(usable)) { try { this.onUnlock(game, id, {live}); } catch {} }
    this.offsets.set(file, {offset: from + Buffer.byteLength(usable), mtime: st.mtimeMs, birth: st.birthtimeMs, head: st.size >= 256 ? head : ''});
   } else this.offsets.set(file, {offset: st.size, mtime: st.mtimeMs, birth: st.birthtimeMs, head: st.size >= 256 ? head : ''});
  }
 }
}

// Port detectado para um jogo de PC (cache por caminho do .exe).
const portCache = new Map();
export function portOf(game) {
 if (!game?.path || game.demo || game.native || !/\.exe$/i.test(game.path) || !['pc', 'custom'].includes(game.profile)) return null;
 const hit = portCache.get(game.path); if (hit && Date.now() - hit.at < 120000) return hit.port;
 let port = null; try { port = consoleTitleNear(game.path); } catch {}
 if (port && !isDir(port.dump)) port = null;
 portCache.set(game.path, {at: Date.now(), port}); return port;
}

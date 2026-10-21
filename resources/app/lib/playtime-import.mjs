// Tempo de jogo de outros programas: Epic (conta conectada), GOG Galaxy (banco local) e Playnite (banco local).
// O valor importado não soma com o do Taiga Launcher: vale o maior (o mesmo tempo pode ter sido contado pelos dois,
// já que o Taiga Launcher abre jogos da Epic e da GOG pelos próprios launchers).
import fs from 'node:fs';
import path from 'node:path';
import {json, save} from './files.mjs';

const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[™®©]/g, '').replace(/[^a-z0-9]+/g, '');

// Epic: tempo por "artifactId" (= AppName do manifesto).
export async function epicPlaytime(auth, {fetchImpl = (...a) => fetch(...a)} = {}) {
 if (!auth?.accessToken || !auth?.accountId) return [];
 const res = await fetchImpl(`https://library-service.live.use1a.on.epicgames.com/library/api/public/playtime/account/${encodeURIComponent(auth.accountId)}/all`, {headers: {Authorization: 'Bearer ' + auth.accessToken}, signal: AbortSignal.timeout(20000)});
 if (!res.ok) throw Error('Epic respondeu HTTP ' + res.status + '.');
 const list = await res.json();
 return (Array.isArray(list) ? list : []).filter(r => r?.artifactId && Number(r.totalTime) > 0).map(r => ({source: 'Epic', key: 'epic:' + String(r.artifactId).toLowerCase(), seconds: Number(r.totalTime)}));
}

// GOG Galaxy 2: tabela GameTimes (minutos por releaseKey, ex.: "gog_1207664663").
export async function gogPlaytime(env = process.env) {
 const db = path.join(env.PROGRAMDATA || env.ProgramData || 'C:\\ProgramData', 'GOG.com', 'Galaxy', 'storage', 'galaxy-2.0.db');
 if (!fs.existsSync(db)) return [];
 let sqlite; try { sqlite = await import('node:sqlite'); } catch { return []; }
 const conn = new sqlite.DatabaseSync(db, {readOnly: true});
 try {
  const rows = conn.prepare('SELECT releaseKey, SUM(minutesInGame) AS minutes FROM GameTimes GROUP BY releaseKey').all();
  return rows.filter(r => Number(r.minutes) > 0).map(r => {
   const key = String(r.releaseKey || ''), gog = key.match(/^gog_(\d+)$/i);
   return {source: 'GOG', key: gog ? 'gog:' + gog[1] : 'galaxy:' + key.toLowerCase(), seconds: Number(r.minutes) * 60};
  });
 } catch { return []; } finally { try { conn.close(); } catch {} }
}

// Playnite: banco LiteDB (games.db). Cada jogo é um documento BSON com "Name" e "Playtime" (segundos); a leitura
// procura os dois campos no mesmo documento, sem depender da biblioteca do Playnite.
export function playnitePlaytime(env = process.env, extra = []) {
 const files = [...extra, env.APPDATA && path.join(env.APPDATA, 'Playnite', 'library', 'games.db')].filter(f => f && fs.existsSync(f));
 const out = [];
 for (const file of files) {
  let buf; try { if (fs.statSync(file).size > 512 * 1024 * 1024) continue; buf = fs.readFileSync(file); } catch { continue; }
  const marker = Buffer.from('\x12Playtime\x00', 'latin1'), nameMarker = Buffer.from('\x02Name\x00', 'latin1');
  for (let at = buf.indexOf(marker); at >= 0; at = buf.indexOf(marker, at + 1)) {
   if (at + marker.length + 8 > buf.length) break;
   const seconds = Number(buf.readBigInt64LE(at + marker.length)); if (!(seconds > 0 && seconds < 100 * 365 * 86400)) continue;
   // "Name" do mesmo documento: o mais próximo dentro da mesma página de 8 KB.
   const page = Math.floor(at / 8192) * 8192, end = Math.min(buf.length, page + 8192);
   let best = null;
   for (let n = buf.indexOf(nameMarker, page); n >= 0 && n < end; n = buf.indexOf(nameMarker, n + 1)) {
    const len = buf.readInt32LE(n + nameMarker.length); if (len < 2 || len > 512 || n + nameMarker.length + 4 + len > buf.length) continue;
    const name = buf.toString('utf8', n + nameMarker.length + 4, n + nameMarker.length + 4 + len - 1);
    const dist = Math.abs(n - at); if (!best || dist < best.dist) best = {name, dist};
   }
   if (best && best.dist < 4096) out.push({source: 'Playnite', key: 'title:' + norm(best.name), title: best.name, seconds});
  }
 }
 return out;
}

// Liga cada tempo importado a um jogo da coleção e grava em playtime-imported.json (uuid → maior valor por fonte).
export function applyImported(games, rows, dataDir) {
 const file = path.join(dataDir, 'playtime-imported.json'), data = json(file, {}) || {};
 const byKey = new Map();
 for (const g of games) {
  if (!g.uuid || g.demo) continue;
  const keys = ['title:' + norm(g.title)];
  if (g.store?.name === 'epic' && g.store.appName) keys.push('epic:' + String(g.store.appName).toLowerCase());
  if (g.store?.name === 'gog' && g.store.id) keys.push('gog:' + String(g.store.id));
  for (const k of keys) if (!byKey.has(k)) byKey.set(k, g);
 }
 let matched = 0;
 for (const r of rows) {
  const g = byKey.get(r.key); if (!g) continue;
  const cur = data[g.uuid] || {};
  if (!cur[r.source] || cur[r.source] < r.seconds) { cur[r.source] = Math.round(r.seconds); matched++; }
  data[g.uuid] = cur;
 }
 save(file, data);
 return {matched, games: Object.keys(data).length};
}

export const importedSeconds = (dataDir, uuid) => { const d = json(path.join(dataDir, 'playtime-imported.json'), {}) || {}; return Math.max(0, ...Object.values(d[uuid] || {}).map(Number).filter(Number.isFinite)); };

// Perfil público do Taiga Launcher (opcional): permite que amigos que também usam o Taiga Launcher vejam, no SEU perfil da
// Comunidade Steam, os jogos adicionados pelo Taiga Launcher (cartões, contadores e conquistas).
//
// Leve por desenho:
//  - O arquivo é pequeno (só textos, números e endereços https das capas e ícones; nenhuma imagem é enviada).
//  - Só é publicado quando muda, e no máximo a cada 10 minutos.
//  - O Taiga Launcher do amigo baixa o arquivo só ao abrir o seu perfil e guarda por 10 minutos.
//  - Sem servidor configurado (padrão), nada sai do PC: o arquivo fica apenas em <dados>\public-profile.json.
//
// Protocolo (para um servidor futuro, ex.: tools/profile-server/worker.js):
//  GET  <servidor>/v1/profiles/<SteamID64>  → JSON do perfil (404 se não houver)
//  PUT  <servidor>/v1/profiles/<SteamID64>  com o cabeçalho X-Taiga-Key: <chave local>; a primeira gravação
//       registra a chave do dono e as seguintes precisam dela.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX = 1024 * 1024;
export function profileServerUrl(value) {
 const v = String(value || '').trim().replace(/\/+$/, ''); if (!v) return '';
 let u; try { u = new URL(v); } catch { throw Error('Endereço do servidor de perfis inválido.'); }
 if (u.protocol !== 'https:' || u.username || u.password) throw Error('O servidor de perfis precisa usar https.');
 return u.toString().replace(/\/+$/, '');
}
const https = v => typeof v === 'string' && /^https:\/\/[^\s"'<>]+$/.test(v) && v.length < 2000 ? v : '';
const text = (v, n) => String(v ?? '').slice(0, n);
// Só os campos conhecidos, com limites: o arquivo de um amigo nunca é usado como veio.
export function sanitizeProfile(raw, steamId) {
 if (!raw || typeof raw !== 'object' || raw.v !== 1 || String(raw.steamId) !== String(steamId) || !Array.isArray(raw.games)) return null;
 const games = raw.games.slice(0, 300).map((g, i) => {
  if (!g || typeof g !== 'object') return null;
  const ach = g.achievements || {}, total = Math.max(0, Math.min(5000, Number(ach.total) || 0)), unlocked = Math.max(0, Math.min(total, Number(ach.unlocked) || 0));
  return {uuid: 'friend-' + text(g.uuid || i, 64).replace(/[^\w-]/g, ''), title: text(g.title, 200), steamAppId: Number.isInteger(g.steamAppId) && g.steamAppId > 0 ? g.steamAppId : null,
   minutes: Math.max(0, Number(g.minutes) || 0), minutesTwoWeeks: Math.max(0, Number(g.minutesTwoWeeks) || 0), lastPlayed: Math.max(0, Number(g.lastPlayed) || 0), recent: !!g.recent,
   achievements: {total, unlocked, perfect: total > 0 && unlocked === total, recentIcons: (Array.isArray(ach.recentIcons) ? ach.recentIcons : []).slice(0, 8).map(a => ({title: text(a?.title, 200), icon: https(a?.icon)})).filter(a => a.icon)},
   images: {header: https(g.images?.header), cover: https(g.images?.cover), hero: https(g.images?.hero)},
   achievementList: (Array.isArray(g.achievementList) ? g.achievementList : []).slice(0, 300).map(a => ({id: '', title: text(a?.title, 200), description: text(a?.description, 400), unlocked: !!a?.unlocked, date: a?.unlocked && !isNaN(Date.parse(a?.date)) ? new Date(a.date).toISOString() : null, icon: https(a?.icon), lockedIcon: https(a?.lockedIcon), globalPercent: Number.isFinite(Number(a?.globalPercent)) && a?.globalPercent !== null ? Number(a.globalPercent) : null}))};
 }).filter(g => g && g.title);
 return {steamId: String(steamId), language: text(raw.language, 8), games};
}

export function createPublicProfile({dir, config, build, fetchImpl = (...a) => fetch(...a), log = () => {}}) {
 const file = path.join(dir, 'public-profile.json'), cache = new Map();
 let lastHash = '', lastPublish = 0, busy = false;
 const key = () => String(config().profileKey || '');
 return {
  // Gera o arquivo local e, com servidor configurado, publica quando mudou (no máximo a cada 10 min).
  async refresh({force = false} = {}) {
   if (busy) return null; busy = true;
   try {
    const profile = await build(); if (!profile.steamId) return null;
    const body = JSON.stringify(profile); if (body.length > MAX) return null;
    const hash = crypto.createHash('sha1').update(body.replace(/"updatedAt":"[^"]*"/, '')).digest('hex');
    if (hash === lastHash && !force) return {changed: false};
    fs.mkdirSync(dir, {recursive: true}); fs.writeFileSync(file, body);
    const server = config().profileServer;
    if (server && key() && (force || Date.now() - lastPublish > 600000)) {
     const res = await fetchImpl(server + '/v1/profiles/' + profile.steamId, {method: 'PUT', headers: {'Content-Type': 'application/json', 'X-Taiga-Key': key()}, body, signal: AbortSignal.timeout(20000)});
     if (!res.ok) throw Error('Servidor de perfis respondeu HTTP ' + res.status + '.');
     lastPublish = Date.now();
    }
    lastHash = hash; return {changed: true, published: !!server};
   } catch (e) { log('Perfil público: ' + e.message); return {error: e.message}; } finally { busy = false; }
  },
  // Perfil de um amigo (só com servidor configurado). Guardado por 10 min; sem servidor, nada é consultado.
  async friend(steamId) {
   const sid = String(steamId || ''); if (!/^\d{17}$/.test(sid)) return {games: []};
   const server = config().profileServer; if (!server) return {games: []};
   const hit = cache.get(sid); if (hit && Date.now() - hit.at < 600000) return hit.value;
   let value = {games: []};
   try {
    const res = await fetchImpl(server + '/v1/profiles/' + sid, {signal: AbortSignal.timeout(10000)});
    if (res.ok) { const t = await res.text(); if (t.length <= MAX) value = sanitizeProfile(JSON.parse(t), sid) || value; }
   } catch {}
   cache.set(sid, {at: Date.now(), value}); if (cache.size > 200) cache.delete(cache.keys().next().value);
   return value;
  },
 };
}

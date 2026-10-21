// Servidor do Taiga Launcher na Cloudflare (Worker). Guarda as chaves do SteamGridDB e da IGDB e um banco próprio
// (D1) com tudo o que já foi pesquisado: quando alguém busca um jogo, a resposta fica salva e serve para todos os
// outros usuários. Assim as APIs recebem um pedido por jogo por mês, e não um por pessoa, e os limites deixam de
// ser um problema.
//
// Configuração (painel da Cloudflare):
//  - Secrets: SGDB_KEY (SteamGridDB), TWITCH_ID e TWITCH_SECRET (IGDB/Twitch).
//  - Binding D1: banco "taiga-cache" com o nome DB (a tabela é criada sozinha no primeiro uso).
//  - (Opcional) Binding KV: PROFILES, para o perfil público de amigos no futuro.
//
// Rotas (só leitura de dados públicos; o programa não consegue gravar nada no banco):
//  GET  /v1/health                     → o que está configurado
//  GET  /v1/sgdb/<endpoint da API v2>  → SteamGridDB (busca, grades, heróis, logos, ícones, jogos)
//  POST /v1/igdb/games  (consulta)     → IGDB
//  GET/PUT /v1/profiles/<SteamID64>    → perfil público (precisa do KV PROFILES)
const MAX = 1024 * 1024;
const DAY = 86400000;
const TTL_OK = 30 * DAY, TTL_EMPTY = 3 * DAY;
const json = (body, status = 200, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {status, headers: {'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', ...extra}});
async function sha256(text) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }

// Limite simples por endereço IP (por instância): evita que alguém use o servidor para esgotar as chaves.
const hitsByIp = new Map();
function tooMany(request) {
 const ip = request.headers.get('cf-connecting-ip') || 'x', now = Date.now(), win = 5 * 60000, max = 400;
 const row = hitsByIp.get(ip); if (!row || now - row.at > win) { hitsByIp.set(ip, {at: now, n: 1}); if (hitsByIp.size > 5000) hitsByIp.clear(); return false; }
 row.n++; return row.n > max;
}

export default {
 async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: {'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, PUT', 'access-control-allow-headers': 'content-type, x-taiga-key'}});
  if (url.pathname === '/v1/health') return json({ok: true, sgdb: !!env.SGDB_KEY, igdb: !!(env.TWITCH_ID && env.TWITCH_SECRET), db: !!env.DB, profiles: !!env.PROFILES});
  if (tooMany(request)) return json({error: 'rate_limited'}, 429, {'retry-after': '60'});
  try {
   if (url.pathname.startsWith('/v1/sgdb/') && request.method === 'GET') return await sgdb(url, env, ctx);
   if (url.pathname === '/v1/igdb/games' && request.method === 'POST') return await igdb(request, env, ctx);
   const m = url.pathname.match(/^\/v1\/profiles\/(\d{17})$/);
   if (m) return await profiles(request, env, m[1]);
  } catch (e) { return json({error: 'server', message: String(e && e.message || e).slice(0, 200)}, 500); }
  return json({error: 'not_found'}, 404);
 },
};

// ── banco compartilhado (D1) + cache da borda ──
let tableReady = false;
async function db(env) {
 if (!env.DB) return null;
 if (!tableReady) { await env.DB.prepare('CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT NOT NULL, status INTEGER NOT NULL, at INTEGER NOT NULL)').run(); tableReady = true; }
 return env.DB;
}
// Ordem: cache da borda (grátis e rápido) → banco D1 → API de origem. Se a origem falhar (limite, fora do ar), a
// resposta antiga do banco é usada mesmo vencida: o programa nunca fica sem resposta por causa de limite.
async function shared(key, env, ctx, fetchOrigin) {
 const edge = caches.default, edgeReq = new Request('https://cache.taiga-launcher/' + await sha256(key));
 const hit = await edge.match(edgeReq); if (hit) return hit;
 const d = await db(env).catch(() => null), k = await sha256(key);
 let row = null; if (d) { try { row = await d.prepare('SELECT v, status, at FROM cache WHERE k = ?').bind(k).first(); } catch {} }
 const fresh = row && Date.now() - row.at < (row.status !== 200 || isEmpty(row.v) ? TTL_EMPTY : TTL_OK);
 const respond = (text, status, source) => { const r = json(text, status, {'cache-control': 'public, max-age=86400', 'x-taiga-cache': source}); ctx.waitUntil(edge.put(edgeReq, r.clone())); return r; };
 if (fresh) return respond(row.v, row.status, 'db');
 let res = null; try { res = await fetchOrigin(); } catch {}
 // "Não encontrado" também fica salvo (por menos tempo): o mesmo jogo inexistente não gasta a chave toda vez.
 if (res && (res.ok || res.status === 404)) {
  const status = res.ok ? 200 : 404, text = res.ok ? await res.text() : '[]'; if (text.length > 512 * 1024) return json(text, status);
  if (d) ctx.waitUntil(d.prepare('INSERT INTO cache (k, v, status, at) VALUES (?, ?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, status = excluded.status, at = excluded.at').bind(k, text, status, Date.now()).run().catch(() => {}));
  return respond(text, status, 'origin');
 }
 if (row) return respond(row.v, row.status, 'db-stale');
 return json({error: 'upstream', status: res ? res.status : 0}, res && res.status === 429 ? 429 : 502);
}
const isEmpty = text => /^\s*(\[\s*\]|\{\s*"success"\s*:\s*true\s*,\s*"data"\s*:\s*\[\s*\]\s*\})\s*$/.test(text);

async function sgdb(url, env, ctx) {
 if (!env.SGDB_KEY) return json({error: 'not_configured'}, 503);
 const endpoint = url.pathname.slice('/v1/sgdb/'.length) + url.search;
 if (!/^(search\/autocomplete|grids|heroes|logos|icons|games)\//.test(endpoint) || endpoint.length > 600) return json({error: 'endpoint'}, 400);
 return shared('sgdb:' + endpoint, env, ctx, () => fetch('https://www.steamgriddb.com/api/v2/' + endpoint, {headers: {Authorization: 'Bearer ' + env.SGDB_KEY}}));
}

// IGDB: até 4 pedidos por segundo por chave. Uma fila por instância segura o ritmo; em "429" espera e tenta de novo.
let twitch = null, lastIgdb = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function igdbToken(env) {
 if (twitch && twitch.until > Date.now()) return twitch.token;
 const t = await (await fetch('https://id.twitch.tv/oauth2/token', {method: 'POST', body: new URLSearchParams({client_id: env.TWITCH_ID, client_secret: env.TWITCH_SECRET, grant_type: 'client_credentials'})})).json();
 if (!t.access_token) throw Error('twitch_auth');
 twitch = {token: t.access_token, until: Date.now() + (Number(t.expires_in) || 3600) * 1000 - 600000}; return twitch.token;
}
async function igdb(request, env, ctx) {
 if (!env.TWITCH_ID || !env.TWITCH_SECRET) return json({error: 'not_configured'}, 503);
 const query = await request.text(); if (query.length > 4000) return json({error: 'too_large'}, 413);
 return shared('igdb:' + query.replace(/\s+/g, ' ').trim(), env, ctx, async () => {
  for (let i = 0; i < 3; i++) {
   const wait = 260 - (Date.now() - lastIgdb); if (wait > 0) await sleep(wait); lastIgdb = Date.now();
   const res = await fetch('https://api.igdb.com/v4/games', {method: 'POST', headers: {'Client-ID': env.TWITCH_ID, Authorization: 'Bearer ' + await igdbToken(env), 'Content-Type': 'text/plain'}, body: query});
   if (res.status === 401) { twitch = null; continue; }
   if (res.status === 429) { await sleep(600 * (i + 1)); continue; }
   return res;
  }
  return new Response('', {status: 429});
 });
}

async function profiles(request, env, id) {
 if (!env.PROFILES) return json({error: 'not_configured'}, 503);
 if (request.method === 'GET') { const v = await env.PROFILES.get('p:' + id); return v ? json(v, 200, {'cache-control': 'public, max-age=300'}) : json({error: 'not_found'}, 404); }
 if (request.method !== 'PUT') return json({error: 'method'}, 405);
 const key = request.headers.get('x-taiga-key') || ''; if (!/^[0-9a-f]{48}$/.test(key)) return json({error: 'key'}, 401);
 const body = await request.text(); if (body.length > MAX) return json({error: 'too_large'}, 413);
 let data; try { data = JSON.parse(body); } catch { return json({error: 'json'}, 400); }
 if (data?.v !== 1 || String(data.steamId) !== id || !Array.isArray(data.games)) return json({error: 'shape'}, 400);
 const owner = await env.PROFILES.get('k:' + id), hash = await sha256(key);
 if (owner && owner !== hash) return json({error: 'owner'}, 403);
 if (!owner) await env.PROFILES.put('k:' + id, hash);
 await env.PROFILES.put('p:' + id, body);
 return json({ok: true});
}

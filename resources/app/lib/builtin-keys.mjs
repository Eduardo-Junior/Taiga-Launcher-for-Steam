// Chaves fixas do programa (SteamGridDB e IGDB/Twitch), lidas de "chaves.json" ao lado do server.mjs ou das
// variáveis de ambiente TAIGA_SGDB_KEY, TAIGA_IGDB_ID e TAIGA_IGDB_SECRET. O arquivo não vai para o repositório
// (.gitignore); entra só no pacote do programa. Uma chave do próprio usuário, se houver, tem prioridade.
import fs from 'node:fs';
import path from 'node:path';

export const KEY_FIELDS = {sgdbKey: 'TAIGA_SGDB_KEY', igdbId: 'TAIGA_IGDB_ID', igdbSecret: 'TAIGA_IGDB_SECRET'};

// root pode ser uma pasta ou uma lista de pastas (a primeira com chaves.json válido vale): pasta do programa
// (resources/app), pasta do .exe e a pasta de dados.
export function readBuiltinKeys(root, env = process.env) {
  let file = {};
  for (const dir of (Array.isArray(root) ? root : [root]).filter(Boolean)) { try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'chaves.json'), 'utf8').replace(/^\uFEFF/, '')) || {}; if (Object.keys(KEY_FIELDS).some(k => String(j[k] || '').trim() && !/^COLE_/i.test(String(j[k])))) { file = j; break; } } catch {} }
  const out = {};
  for (const [k, e] of Object.entries(KEY_FIELDS)) { const v = String(env[e] || file[k] || '').trim(); if (v && !/^COLE_/i.test(v)) out[k] = v; }
  return out;
}

// Liga as chaves fixas ao objeto de configuração sem gravá-las no config.json do usuário.
export function attachBuiltinKeys(config, builtin) {
  for (const k of Object.keys(KEY_FIELDS)) {
    const own = 'own_' + k;
    if (typeof config[own] !== 'string') config[own] = typeof config[k] === 'string' ? config[k] : '';
    delete config[k];
    Object.defineProperty(config, k, {configurable: true, enumerable: false, get() { return this[own] || builtin[k] || ''; }, set(v) { this[own] = String(v || ''); }});
  }
  return config;
}

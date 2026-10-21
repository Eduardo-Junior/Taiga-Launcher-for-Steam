// AppID da Steam a partir do ID da loja (Epic, GOG, Xbox…), sem depender do nome: o IGDB e o SteamGridDB guardam o
// ID de cada jogo em cada loja. Só quando os dois lados apontam para o mesmo jogo a ligação é feita.
const IGDB_STORE = {epic: 26, gog: 5, xbox: 11, microsoft: 11, amazon: 20};
const SGDB_STORE = {epic: 'egs', origin: 'origin', ea: 'origin', ubisoft: 'uplay', uplay: 'uplay', battlenet: 'bnet'};
const clean = v => String(v || '').trim();

export function storeIds(game) {
 const s = game.store || {}, name = String(s.name || '').toLowerCase();
 return {store: name, ids: [...new Set([clean(s.id), clean(s.namespace), clean(s.appName), clean(game.launch?.storeId)].filter(v => v && v.length >= 3 && v.length <= 80))]};
}

export async function steamIdFromStore(game, providers, {log = () => {}} = {}) {
 const {store, ids} = storeIds(game);
 if (!store || !ids.length) return null;
 // IGDB: o jogo cujo ID externo da loja bate; dele sai o ID externo da Steam (categoria 1).
 const cat = IGDB_STORE[store];
 if (cat && providers.igAvailable?.()) {
  try {
   const list = await providers.ig(`fields id,name,external_games.category,external_games.uid,external_games.external_game_source; where external_games.uid = (${ids.map(i => JSON.stringify(i)).join(',')}); limit 10;`);
   for (const g of Array.isArray(list) ? list : []) {
    const ext = g.external_games || [];
    const own = ext.some(e => ids.includes(String(e.uid)) && (Number(e.category ?? e.external_game_source) === cat));
    const steam = ext.find(e => Number(e.category ?? e.external_game_source) === 1 && /^\d{1,10}$/.test(String(e.uid)));
    if (own && steam) { log('ID da loja ' + store + ' → Steam ' + steam.uid + ' (IGDB: ' + g.name + ')'); return {appId: Number(steam.uid), source: 'igdb', name: g.name}; }
   }
  } catch (e) { log('IGDB (ID da loja): ' + e.message); }
 }
 // SteamGridDB: /games/<loja>/<id> e os dados da plataforma Steam do mesmo jogo.
 const plat = SGDB_STORE[store];
 if (plat && providers.sgAvailable?.()) {
  for (const id of ids) {
   try {
    const g = await providers.sg('games/' + plat + '/' + encodeURIComponent(id));
    const gid = Array.isArray(g) ? g[0]?.id : g?.id; if (!gid) continue;
    const full = await providers.sg('games/id/' + gid + '?platformdata=steam');
    const steam = (Array.isArray(full) ? full[0] : full)?.external_platform_data?.steam?.[0]?.id;
    if (/^\d{1,10}$/.test(String(steam || ''))) { log('ID da loja ' + store + ' → Steam ' + steam + ' (SteamGridDB)'); return {appId: Number(steam), source: 'sgdb', name: (Array.isArray(full) ? full[0] : full)?.name || ''}; }
   } catch {}
  }
 }
 return null;
}

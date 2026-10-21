// Dados dos jogos do Taiga Launcher para as páginas do perfil na Comunidade Steam (Jogos, Recém-jogados, Concluídos e
// Conquistas). Só leitura: o que a página recebe são os mesmos dados que a Biblioteca já mostra.
import fs from 'node:fs';
import path from 'node:path';

const CDN = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/';
const MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webp': 'image/webp'};
const WIDTH = {header: 460, cover: 300, hero: 1920, icon: 128, logo: 640};

export function createCommunity({language = () => 'pt-BR', artOrigin = () => '', games, account, steamId, steamAppIdOf, virtualAppIdOf, playtimeOf, achievementsOf, cachedAchievementsOf, artDir, port, imageThumb = null, log = () => {}}) {
 const thumbs = new Map(), lastKnown = new Map(); let listCache = null;
 const ours = () => games().filter(g => !g.demo && !g.hidden && !g.native && g.uuid && Number(g.bindings?.[account()]) > 0);
 const byUuid = uuid => ours().find(g => g.uuid === String(uuid || '')) || null;
 async function dataUrl(file, width) {
  const key = file + '|' + width; if (thumbs.has(key)) return thumbs.get(key);
  let bytes; try { const st = fs.statSync(file); if (!st.isFile() || st.size > 24 * 1024 * 1024) return ''; bytes = fs.readFileSync(file); } catch { return ''; }
  let mime = MIME[path.extname(file).toLowerCase()] || 'image/png';
  if (imageThumb) { try { const out = await imageThumb(bytes, {width}); if (out?.length) { bytes = out; mime = out[0] === 0x89 ? 'image/png' : 'image/jpeg'; } } catch {} }
  const url = 'data:' + mime + ';base64,' + bytes.toString('base64');
  if (thumbs.size > 400) thumbs.clear(); thumbs.set(key, url); return url;
 }
 const artFile = name => name && /^[a-f0-9]+\.(png|jpg|jpeg|ico|webp)$/i.test(String(name)) ? path.join(artDir, String(name)) : '';
 // Imagens locais (servidas pelo Taiga Launcher em 127.0.0.1) viram data:, a página da Comunidade é https e não deve
 // depender de acesso à rede local. Endereços https (RetroAchievements, Epic, Steam) seguem como estão.
 async function portable(url, width) {
  const u = String(url || ''); if (!u) return '';
  if (/^https:\/\//i.test(u)) return u;
  const m = u.match(/^(?:https?:\/\/(?:127\.0\.0\.1|localhost):\d+)?\/art\/([a-f0-9]+\.(?:png|jpg|jpeg|ico|webp))$/i);
  return m ? dataUrl(path.join(artDir, m[1]), width) : '';
 }
 async function image(g, kind) {
  const art = g.art || {}, sid = steamAppIdOf(g);
  const local = {header: art.wide || art.hero || art.cover, cover: art.cover || art.wide, hero: art.hero || art.wide || art.cover, icon: art.icon, logo: art.logo}[kind];
  if (local && artFile(local)) { const url = await dataUrl(artFile(local), WIDTH[kind] || 460); if (url) return url; }
  if (sid) return CDN + sid + '/' + ({header: 'header.jpg', cover: 'library_600x900_2x.jpg', hero: 'library_hero.jpg', icon: 'header.jpg', logo: 'logo.png'}[kind] || 'header.jpg');
  return '';
 }
 function summary(g, data) {
  const list = data?.achievements || [], unlocked = list.filter(a => a.unlocked), two = Date.now() - 14 * 86400000;
  const dateOf = a => { const t = Date.parse(a.date || ''); return Number.isFinite(t) ? t : 0; };
  const recent = unlocked.filter(a => dateOf(a) > two).sort((a, b) => dateOf(b) - dateOf(a)).slice(0, 8);
  return {total: list.length, unlocked: unlocked.length, perfect: list.length > 0 && unlocked.length === list.length, recentIcons: recent.map(a => ({title: a.title || '', icon: a.icon || ''}))};
 }
 function base(g) {
  const sid = Number(g.bindings?.[account()]) >>> 0, p = playtimeOf(g, sid) || {};
  const last = Number(p.last_played_at) || 0;
  return {uuid: g.uuid, title: g.title, shortcutAppId: String(sid), appId: String(steamAppIdOf(g) || virtualAppIdOf(g.uuid) || ''), steamAppId: steamAppIdOf(g) || null,
   minutes: Math.round((Number(p.seconds_forever) || 0) / 60), minutesTwoWeeks: Math.round((Number(p.seconds_last_two_weeks) || 0) / 60), lastPlayed: last,
   recent: !!last && last * 1000 > Date.now() - 14 * 86400000};
 }
 return {
  // Lista leve (sem imagens): a página pede as imagens de cada cartão depois.
  async games() {
   if (listCache && Date.now() - listCache.at < 15000) return listCache.value;
   const list = [], games = ours();
   // Conquistas ainda não lidas (ex.: logo depois de abrir o programa): espera até 4 s por todas juntas.
   // (Lista da Epic sem progresso conhecido não fica no cache do programa, então usa a resposta direta.)
   const fresh = new Map(), missing = games.filter(g => !cachedAchievementsOf(g));
   if (missing.length) await Promise.race([Promise.allSettled(missing.map(g => achievementsOf(g).then(d => fresh.set(g.uuid, d)))), new Promise(r => setTimeout(r, 4000))]);
   for (const g of games) {
    const data = cachedAchievementsOf(g) || fresh.get(g.uuid) || lastKnown.get(g.uuid) || null;
    if (data) lastKnown.set(g.uuid, data);
    const s = summary(g, data), icons = [];
    for (const a of s.recentIcons) icons.push({title: a.title, icon: await portable(a.icon, 64)});
    list.push({...base(g), achievements: {total: s.total, unlocked: s.unlocked, perfect: s.perfect, recentIcons: icons.filter(a => a.icon)}});
   }
   const value = {steamId: steamId() || '', language: language(), games: list}; listCache = {at: Date.now(), value}; return value;
  },
  async image({uuid, kind} = {}) { const g = byUuid(uuid); if (!g || !['header', 'cover', 'hero', 'icon', 'logo'].includes(kind)) return {url: ''}; return {url: await image(g, kind)}; },
  async achievements({uuid} = {}) {
   const g = byUuid(uuid); if (!g) throw Error('Jogo não encontrado.');
   let data = null; try { data = await achievementsOf(g); } catch { data = cachedAchievementsOf(g); }
   // Textos ainda sendo traduzidos para o idioma do Taiga Launcher: espera um pouco pela tradução (até 10 s).
   for (let i = 0; i < 20 && data?.translationStatus === 'pending'; i++) { await new Promise(r => setTimeout(r, 500)); data = cachedAchievementsOf(g) || data; }
   const items = [];
   for (const a of data?.achievements || []) items.push({id: String(a.id), title: a.title || String(a.id), description: a.description || '', hidden: !!a.hidden, unlocked: !!a.unlocked, date: a.unlocked && a.date ? a.date : null,
    icon: await portable(a.icon, 128), lockedIcon: await portable(a.lockedIcon || a.icon, 128), globalPercent: Number.isFinite(Number(a.globalPercent)) && a.globalPercent !== null ? Number(a.globalPercent) : null});
   return {...base(g), source: data?.source || '', achievements: items, hero: await image(g, 'hero'), cover: await image(g, 'cover')};
  },
  ours,
  // Perfil público (para amigos com o Taiga Launcher): só endereços https das artes e ícones, nada de arquivos locais.
  async publicProfile() {
   const list = await this.games(), out = [];
   for (const item of list.games.slice(0, 300)) {
    const g = byUuid(item.uuid); if (!g) continue;
    const art = g.art || {}, sid = steamAppIdOf(g), web = name => { const u = artOrigin(name); return /^https:\/\//.test(u) ? u : ''; };
    const images = {header: web(art.wide) || web(art.hero) || (sid ? CDN + sid + '/header.jpg' : '') || web(art.cover), cover: web(art.cover) || (sid ? CDN + sid + '/library_600x900_2x.jpg' : ''), hero: web(art.hero) || web(art.wide) || (sid ? CDN + sid + '/library_hero.jpg' : '')};
    const data = cachedAchievementsOf(g) || lastKnown.get(g.uuid);
    const achievements = (data?.achievements || []).slice(0, 300).map(a => ({title: String(a.title || '').slice(0, 200), description: String(a.description || '').slice(0, 400), unlocked: !!a.unlocked, date: a.unlocked && a.date ? a.date : null, icon: /^https:\/\//.test(a.icon || '') ? a.icon : '', lockedIcon: /^https:\/\//.test(a.lockedIcon || '') ? a.lockedIcon : '', globalPercent: Number.isFinite(Number(a.globalPercent)) && a.globalPercent !== null ? Number(a.globalPercent) : null}));
    out.push({uuid: item.uuid, title: item.title, steamAppId: item.steamAppId, minutes: item.minutes, minutesTwoWeeks: item.minutesTwoWeeks, lastPlayed: item.lastPlayed, recent: item.recent, achievements: {...item.achievements, recentIcons: item.achievements.recentIcons.filter(a => /^https:\/\//.test(a.icon))}, images, achievementList: achievements});
   }
   return {v: 1, app: 'Taiga Launcher', steamId: list.steamId, language: list.language, updatedAt: new Date().toISOString(), games: out};
  },
 };
}

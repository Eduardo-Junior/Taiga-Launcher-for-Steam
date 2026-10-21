// Loja, notícias, comunidade e social, porte de store.lua, news.lua, community.lua e social.lua do
// NativeGameLink for Steam (MIT). Mesmas rotas públicas da Steam e mesmo formato de resposta.
// Jogos sem AppID real da Steam (emuladores) usam um AppID virtual; para eles o `virtual` responde com os
// dados do Taiga Launcher e as rotas da Steam não são consultadas.
import {httpGet, trim, urlEncode, htmlUnescape, normalizeAppIdAndLanguage, TtlCache} from './core.mjs';

export const VIRTUAL_MIN = 1900000000, VIRTUAL_MAX = 1999999999;
export const isVirtualAppId = id => { const n = Number(id); return Number.isInteger(n) && n >= VIRTUAL_MIN && n <= VIRTUAL_MAX; };

export function createSteamWeb({virtual = null, log = () => {}} = {}) {
 const M = {};
 const fetchText = (url, accept = '*/*', timeout = 15, headers = {}) => httpGet(url, {headers: {Accept: accept, ...headers}, timeout});

 // ── store.lua ──
 const communityGameName = html => { let name = String(html || '').match(/class="apphub_AppName"[^>]*>([^<]+)</)?.[1] || String(html || '').match(/<title>\s*Steam Community ::\s*([^<]+)<\/title>/)?.[1] || ''; name = trim(htmlUnescape(name)); return !name || name.toLowerCase() === 'steam community' ? null : name; };
 async function communityAchievementCount(appid) { const r = await fetchText('https://steamcommunity.com/stats/' + appid + '/achievements?l=english', 'text/html,*/*', 8); if (!r || r.status !== 200 || !r.body) return 0; return (r.body.match(/<div class="achieveRow[\s"]/g) || []).length; }
 async function recoverDelistedGame(appid) {
  const r = await fetchText('https://steamcommunity.com/app/' + appid, 'text/html,*/*', 10);
  if (!r || r.status !== 200 || !r.body) return null;
  const name = communityGameName(r.body); if (!name) return null;
  const count = await communityAchievementCount(appid), root = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/' + appid + '/';
  return {type: 'game', name, steam_appid: Number(appid) || 0, header_image: root + 'header.jpg', capsule_image: '', capsule_imagev5: '', background: '', background_raw: '', short_description: '', achievements: {total: count}, is_delisted: true,
   metadata_sources: {identity: 'steam_community_app_hub', artwork: 'probe_on_demand', news: 'steam_news_web_api', community: 'steam_community_app_hub', achievements: count > 0 ? 'steam_community_stats' : 'unavailable'},
   historical_capabilities: {identity: 'available', artwork: 'probe_on_demand', news: 'probe_on_demand', community: 'available', achievements: count > 0 ? 'available' : 'unavailable'}};
 }
 const gameDataCache = new TtlCache(96);
 M.fetch_game_data = async ({steam_app_id, language} = {}) => {
  const [appid, lang] = normalizeAppIdAndLanguage(steam_app_id, language);
  if (!/^\d+$/.test(appid)) return JSON.stringify({error: 'invalid_appid'});
  if (isVirtualAppId(appid)) { const data = virtual ? await virtual.gameData(Number(appid), lang) : null; return JSON.stringify(data || {error: 'App not found in Steam Store or Steam Community'}); }
  const key = appid + '|' + lang, cached = gameDataCache.get(key, 1800); if (cached) return cached;
  const res = await fetchText('https://store.steampowered.com/api/appdetails?appids=' + appid + '&l=' + lang, 'application/json', 15);
  if (res && res.status === 200 && res.body) {
   let body = null; try { body = JSON.parse(res.body); } catch {}
   const app = body?.[appid];
   if (app?.success && app.data && typeof app.data === 'object') {
    if (String(app.data.type || '').toLowerCase() === 'advertising') { app.data.is_delisted = true; app.data.historical_capabilities ||= {identity: 'available', artwork: 'probe_on_demand', news: 'probe_on_demand', community: 'probe_on_demand', achievements: 'probe_on_demand'}; }
    app.data.metadata_sources ||= {identity: 'steam_store_api', artwork: 'steam_store_api'};
    return gameDataCache.set(key, JSON.stringify(app.data));
   }
  }
  const recovered = await recoverDelistedGame(appid);
  if (recovered) return gameDataCache.set(key, JSON.stringify(recovered));
  return JSON.stringify({error: 'App not found in Steam Store or Steam Community'});
 };

 // ── news.lua ──
 async function fetchNewsJson(appid, lang) {
  let url = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=' + appid + '&count=50&maxlength=900&format=json&feeds=steam_community_announcements,steam_release';
  if (lang) url += '&l=' + lang;
  const res = await fetchText(url, 'application/json', 6);
  if (!res) return [[], true];
  if (res.status !== 200 || !res.body) return [[], res.status >= 500 || !res.status];
  let items; try { items = JSON.parse(res.body)?.appnews?.newsitems; } catch {}
  if (!Array.isArray(items)) return [[], true];
  const out = [];
  for (const it of items) {
   let host = String(it.url || '').toLowerCase().match(/^https?:\/\/([^/?#]+)/)?.[1] || '';
   if (host === 'steamstore-a.akamaihd.net' && /\/news\/externalpost\/steam_community_announcements\/\d+/.test(String(it.url))) { it.url = String(it.url).replace(/^https?:\/\/[^/]+/, 'https://store.steampowered.com'); host = 'store.steampowered.com'; }
   const official = host === 'steampowered.com' || /^[a-z0-9.-]+\.steampowered\.com$/.test(host) || host === 'steamcommunity.com' || /^[a-z0-9.-]+\.steamcommunity\.com$/.test(host);
   const feed = String(it.feedname || ''), isSteam = ['steam_community_announcements', 'steam_store_release_metadata', 'steam_release', ''].includes(feed);
   if (official && isSteam) out.push(it);
  }
  return [out, false];
 }
 M.fetch_news = async ({steam_app_id, language} = {}) => {
  const [appid, safe] = normalizeAppIdAndLanguage(steam_app_id, language);
  if (!/^\d+$/.test(appid)) return JSON.stringify({error: 'invalid_appid', appnews: {newsitems: []}});
  if (isVirtualAppId(appid)) { const items = virtual ? await virtual.news(Number(appid), safe) : []; return JSON.stringify({items, available: items.length > 0, unavailable: items.length === 0, transient_error: false, source: 'taigasteam', historical_enrichment: false}); }
  const [news, transient] = await fetchNewsJson(appid, safe.replace(/[^\w]/g, ''));
  return JSON.stringify({items: news, available: news.length > 0, unavailable: !news.length && !transient, transient_error: transient && !news.length, source: 'steam_news_web_api', historical_enrichment: false});
 };
 function eventToNewsItem(ev) {
  if (!ev || typeof ev !== 'object') return null;
  const ann = ev.announcement_body && typeof ev.announcement_body === 'object' ? ev.announcement_body : {};
  const title = String(ann.headline || ev.event_name || ''); if (!title) return null;
  const item = {gid: String(ev.gid || ann.event_gid || ann.gid || ''), title, contents: String(ann.body || ev.event_notes || ''), date: Number(ann.posttime || ev.rtime32_start_time || 0) || 0, event_type: Number(ev.event_type || 0) || 0, image: '', feedlabel: 'Steam News', appid: Number(ev.appid || 0) || 0};
  const clanid = String(ann.clanid || '');
  if (typeof ev.jsondata === 'string' && ev.jsondata.length > 2 && clanid) { try { const jd = JSON.parse(ev.jsondata); let img = null; for (const f of ['localized_capsule_image', 'localized_title_image']) if (!img && Array.isArray(jd[f])) img = jd[f].find(v => typeof v === 'string' && v) || null; if (img) item.image = 'https://clan.akamai.steamstatic.com/images/' + clanid + '/' + img; } catch {} }
  return item;
 }
 const partnerUnavailable = new TtlCache(64);
 async function scrapePartnerEvents(appid, lang, max = 10) {
  if (partnerUnavailable.get(appid) !== undefined) return [[], true, false];
  const res = await fetchText('https://store.steampowered.com/news/app/' + appid + '?l=' + lang, 'text/html,*/*', 8);
  if (!res || res.status !== 200 || !res.body) { if (res && (res.status === 404 || res.status === 410)) { partnerUnavailable.set(appid, 1); return [[], true, false]; } return [[], false, true]; }
  const m = res.body.match(/data-initialEvents="([^"]*)"/i);
  if (!m) { partnerUnavailable.set(appid, 1); return [[], true, false]; }
  let body; try { body = JSON.parse(htmlUnescape(m[1])); } catch {}
  if (!body || !Array.isArray(body.events)) { partnerUnavailable.set(appid, 1); return [[], true, false]; }
  const items = []; for (const ev of body.events) { const it = eventToNewsItem(ev); if (it) items.push(it); if (items.length >= max) break; }
  return [items, false, false];
 }
 M.fetch_partner_events = async ({steam_app_id, language} = {}) => {
  const [appid, safe] = normalizeAppIdAndLanguage(steam_app_id, language);
  if (!/^\d+$/.test(appid)) return JSON.stringify({items: [], available: false, error: 'invalid_appid'});
  if (isVirtualAppId(appid)) return JSON.stringify({items: [], available: false, unavailable: true, transient_error: false, source: 'taigasteam'});
  const [items, unavailable, transient] = await scrapePartnerEvents(appid, safe.replace(/[^\w]/g, '') || 'english', 50);
  return JSON.stringify({items, available: items.length > 0, unavailable: unavailable === true, transient_error: transient === true, source: 'steam_store_partner_events'});
 };

 // ── community.lua ──
 function parseHubCards(html, fallbackType, items, safe) {
  let delim = 'id="apphub_Card_'; if (!html.includes(delim)) delim = "id='apphub_Card_"; if (!html.includes(delim)) delim = 'id=apphub_Card_'; if (!html.includes(delim)) return;
  let pos = html.indexOf(delim); const seen = new Set(items.map(i => i.link || i.image));
  while (items.length < 120 && pos >= 0) {
   const next = html.indexOf(delim, pos + 20), card = html.slice(pos, next >= 0 ? next : html.length), item = {};
   const realVideo = /apphub_CardContentPlayVideo|video_play_icon|data-youtube-id|apphub_CardContentVideoImage|img\.youtube\.com|i\.ytimg\.com|youtube\.com\/watch|youtu\.be/.test(card);
   const contentType = card.match(/apphub_CardContentType[^"]*"[^>]*>\s*([\w\sÀ-ɏ]+)/)?.[1] || card.match(/appHubCardContentType[^"]*"[^>]*>\s*([\w\sÀ-ɏ]+)/)?.[1];
   const yt = card.match(/data-youtube-id="([^"]+)"/)?.[1] || card.match(/youtubeid="([^"]+)"/)?.[1] || card.match(/img\.youtube\.com\/vi\/([^/"\s]+)/)?.[1] || card.match(/ytimg\.com\/vi\/([^/"\s]+)/)?.[1] || card.match(/youtube\.com\/watch\?[^"'\s]*v=([\w-]+)/)?.[1] || card.match(/youtu\.be\/([\w-]+)/)?.[1] || card.match(/youtube\.com\/embed\/([^/"'\s?]+)/)?.[1];
   if (yt) { item.youtube_id = yt; item.type = 'video'; item.label = 'Video'; }
   else if (realVideo) { item.type = 'video'; item.label = 'Video'; }
   else if (contentType) { const ct = contentType.toLowerCase(); if (/guide|guía|guia/.test(ct)) { item.type = 'guide'; item.label = 'Guide'; } else if (/video|vídeo/.test(ct)) { item.type = 'video'; item.label = 'Video'; } else if (/artwork|arte|gráfico|grafico|material/.test(ct)) { item.type = 'artwork'; item.label = 'Artwork'; } else if (/screenshot|captura/.test(ct)) { item.type = 'screenshot'; item.label = 'Screenshot'; } else item.type = fallbackType === 'guide' ? 'guide' : 'screenshot'; }
   else if (fallbackType === 'guide' && /apphub_CardContentGuide|GuideImage/.test(card)) { item.type = 'guide'; item.label = 'Guide'; }
   else item.type = fallbackType === 'artwork' ? 'artwork' : 'screenshot';
   item.image = card.match(/apphub_CardContentPreviewImage" src="([^"]+)"/)?.[1] || (item.youtube_id ? 'https://img.youtube.com/vi/' + item.youtube_id + '/hqdefault.jpg' : null) || card.match(/apphub_CardContentGuideImage" src="([^"]+)"/)?.[1] || card.match(/apphub_CardContentVideoImage" src="([^"]+)"/)?.[1] || card.match(/<img[^>]+src="(https:\/\/images\.steamusercontent\.com\/[^"]+)"/)?.[1] || card.match(/<img[^>]+src="(https:\/\/img\.youtube\.com\/[^"]+)"/)?.[1] || card.match(/<img[^>]+src="(https:\/\/i\.ytimg\.com\/[^"]+)"/)?.[1] || null;
   if (!item.youtube_id && item.image) item.youtube_id = item.image.match(/img\.youtube\.com\/vi\/([^/"\s]+)/)?.[1] || item.image.match(/ytimg\.com\/vi\/([^/"\s]+)/)?.[1];
   if (item.youtube_id) { item.type = 'video'; item.label = 'Video'; item.image ||= 'https://img.youtube.com/vi/' + item.youtube_id + '/hqdefault.jpg'; } else delete item.youtube_id;
   let rawTitle = card.match(/apphub_CardContentTitle[^"]*"[^>]*>\s*([\s\S]*?)\s*<\//)?.[1];
   if (!rawTitle) { const block = card.match(/apphub_CardContentGuideTitle[^>]*>([\s\S]*?)<\/div/)?.[1]; if (block) rawTitle = block.replace(/<[^>]+>/g, '').trim(); }
   if (rawTitle) item.title = htmlUnescape(rawTitle).replace(/\s+$/, '');
   const rawDesc = card.match(/apphub_CardContentGuideDesc[^>]*>([\s\S]*?)<\/div/)?.[1];
   if (rawDesc) item.description = htmlUnescape(rawDesc.replace(/<[^>]+>/g, '')).trim();
   item.author_avatar = card.match(/appHubIconHolder[^>]*><img src="([^"]+)"/)?.[1];
   const author = card.match(/apphub_CardContentAuthorName[\s\S]*?<a[^>]*>([^<]*)<\/a>/)?.[1]; if (author) item.author_name = htmlUnescape(author).replace(/\s+$/, '');
   item.link = card.match(/data-modal-content-url="([^"]*)"/)?.[1] || card.match(/href="([^"]*sharedfiles\/filedetails[^"]*)"/)?.[1];
   if (!item.link) { const windowHtml = html.slice(Math.max(0, pos - 3000), pos); for (const m of windowHtml.matchAll(/data-modal-content-url="([^"]*)"/g)) item.link = m[1]; }
   if (!item.link) { const id = card.match(/data-publishedfileid="([^"]*)"/)?.[1] || card.match(/id="apphub_Card_(\d+)"/)?.[1]; if (id) item.link = 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + id; }
   if (item.link) item.link = item.link.replace(/&amp;/g, '&');
   const cyrUser = ['russian', 'ukrainian', 'bulgarian'].includes(safe), cjkUser = ['schinese', 'tchinese', 'japanese', 'koreana'].includes(safe);
   const skip = (!cyrUser && /[Ѐ-ӿ]/.test((rawTitle || '') + (rawDesc || ''))) || (!cjkUser && /[぀-鿿가-힯]/.test(rawTitle || ''));
   const key = item.link || item.image;
   if (!skip && item.image && key && !seen.has(key)) { seen.add(key); for (const k of Object.keys(item)) if (item[k] === undefined || item[k] === null) delete item[k]; items.push(item); }
   pos = next;
  }
 }
 const communityCache = new TtlCache(48);
 M.fetch_community_content = async ({steam_app_id, language} = {}) => {
  const [appid, safe] = normalizeAppIdAndLanguage(steam_app_id, language);
  if (!/^\d+$/.test(appid)) return JSON.stringify({items: [], available: false, error: 'invalid_appid'});
  // Conteúdo da comunidade só existe para jogos da Steam.
  if (isVirtualAppId(appid)) return JSON.stringify({items: [], available: false, unavailable: true, source: 'taigasteam'});
  const key = appid + '|' + safe, cached = communityCache.get(key, 3600); if (cached) return cached;
  const items = []; let ok = 0;
  const headersFor = lang => ({Accept: 'text/html,*/*', Cookie: 'Steam_Language=' + lang + '; steamLanguage=' + lang + '; timezoneOffset=-18000,0;', 'Accept-Language': lang});
  const feed = async (lang, filter, pages) => { for (let p = 1; p <= pages; p++) { const r = await httpGet('https://steamcommunity.com/app/' + appid + '/homecontent/?l=' + urlEncode(lang) + (filter ? '&filterLanguage=' + urlEncode(filter) : '') + '&browsefilter=trend&numperpage=30&p=' + p + '&appid=' + appid + '&forceanon=1', {headers: headersFor(lang), timeout: 10}); if (r && r.status === 200 && r.body) { ok++; parseHubCards(r.body, null, items, safe); } if (items.length >= 50) break; } };
  const sub = async (lang, filter, section, fallback) => { const r = await httpGet('https://steamcommunity.com/app/' + appid + '/homecontent/?l=' + urlEncode(lang) + (filter ? '&requiredtags[0]=' + urlEncode(filter) : '') + '&browsefilter=trend&numperpage=20&p=1&appid=' + appid + '&appHubSubSection=' + section + '&forceanon=1', {headers: headersFor(lang), timeout: 10}); if (r && r.status === 200 && r.body) { ok++; parseHubCards(r.body, fallback, items, safe); } };
  const family = ['spanish', 'latam'].includes(safe) ? ['spanish', 'latam'] : ['portuguese', 'brazilian'].includes(safe) ? ['brazilian', 'portuguese'] : ['schinese', 'tchinese'].includes(safe) ? ['schinese', 'tchinese'] : [safe];
  if (family[0] !== 'english') for (const lang of family) { await feed(lang, lang, 2); await sub(lang, lang, 9, 'guide'); await sub(lang, lang, 3, 'video'); await sub(lang, lang, 4, 'artwork'); if (items.length >= 50) break; }
  if (items.length < 24) { await feed('english', null, 2); await sub('english', null, 3, 'video'); await sub('english', null, 9, 'guide'); await sub('english', null, 4, 'artwork'); }
  const out = JSON.stringify({items, available: items.length > 0, transient_error: ok === 0, source: 'steam_community_app_hub'});
  if (ok) communityCache.set(key, out);
  return out;
 };
 const cleanText = v => htmlUnescape(String(v ?? '')).replace(/<[\s\S]*?>/g, ' ').replace(/\s+/g, ' ').trim();
 const isSteamAsset = url => { const v = String(url || '').toLowerCase(); return v.startsWith('https://') && (v.includes('steamstatic.com/') || /steamcdn-a\.akamaihd\.net\//.test(v) || /steamcommunity-a\.akamaihd\.net\//.test(v)); };
 function parseBadgeCatalog(html, appid) {
  const badges = [], seen = new Set();
  for (const m of html.matchAll(/<div class="badge-item([^"]*)"[^>]*>\s*<img[^>]*?src="([^"]+)"[^>]*?alt="([^"]+)"/g)) {
   const image = htmlUnescape(m[2]), alt = cleanText(m[3]);
   if (!isSteamAsset(image) || seen.has(image)) continue; seen.add(image);
   const foil = m[1].toLowerCase().includes('foil') || alt.toLowerCase().includes('badge foil');
   badges.push({title: cleanText(alt.match(/[Ff]oil:\s*(.+)$/)?.[1] || alt.match(/[Ll]evel\s+\d+:\s*(.+)$/)?.[1] || alt), image, foil, level: Number(alt.match(/[Ll]evel\s+(\d+)/)?.[1] || 0)});
  }
  return {appid: Number(appid) || 0, badges, foil_badge: badges.find(b => b.foil) || null};
 }
 function parseMarketCatalog(body) {
  const cards = [], seen = new Set(); let payload; try { payload = JSON.parse(String(body || '')); } catch { return cards; }
  for (const result of Array.isArray(payload?.results) ? payload.results : []) {
   const d = result?.asset_description; if (!d || typeof d !== 'object') continue;
   const type = String(d.type || '').toLowerCase(), hash = String(d.market_hash_name || result.hash_name || ''), title = cleanText(d.name || result.name || ''), icon = String(d.icon_url_large || d.icon_url || '');
   const foil = type.includes('foil') || hash.toLowerCase().includes('(foil)');
   if (type && !foil && title && icon) { const image = icon.startsWith('https://') ? icon : 'https://community.cloudflare.steamstatic.com/economy/image/' + icon; const key = (hash || title).toLowerCase(); if (isSteamAsset(image) && !seen.has(key)) { seen.add(key); cards.push({title, image, artwork: ''}); } }
  }
  return cards;
 }
 const itemsCache = new TtlCache(32);
 M.fetch_community_items_catalog = async ({steam_app_id, language} = {}) => {
  const [appid, safe] = normalizeAppIdAndLanguage(steam_app_id, language);
  if (!/^\d+$/.test(appid)) return JSON.stringify({error: 'invalid_appid', cards: [], badges: []});
  if (isVirtualAppId(appid)) return JSON.stringify({appid: Number(appid), cards: [], badges: [], source: 'unavailable'});
  const key = appid + '|' + safe, cached = itemsCache.get(key); if (cached && Date.now() - cached.time < (cached.complete ? 3600000 : 10000)) return cached.value;
  const market = await httpGet('https://steamcommunity.com/market/search/render/?query=&start=0&count=100&search_descriptions=0&sort_column=name&sort_dir=asc&appid=753&l=' + urlEncode(safe) + '&category_753_Game%5B%5D=tag_app_' + appid + '&norender=1&category_753_item_class%5B%5D=tag_item_class_2&category_753_cardborder%5B%5D=tag_cardborder_0', {headers: {Accept: 'application/json,text/plain,*/*', 'Accept-Language': 'en-US,en;q=0.8'}, timeout: 4});
  const result = {appid: Number(appid) || 0, cards: [], badges: [], source: 'unavailable'};
  const marketOk = market && market.status === 200 && typeof market.body === 'string';
  if (marketOk) { result.cards = parseMarketCatalog(market.body); if (result.cards.length) result.source = 'steam-community-market'; }
  const badge = await httpGet('https://steamlvlup.com/gameinfo/' + appid, {headers: {Accept: 'text/html,*/*', 'Accept-Language': 'en-US,en;q=0.8'}, timeout: 4});
  const badgeOk = badge && badge.status === 200, badgeEmpty = badge && (badge.status === 404 || badge.status === 410);
  if (badgeOk) { const idx = parseBadgeCatalog(badge.body, appid); result.badges = idx.badges; result.foil_badge = idx.foil_badge; }
  result.transient_error = !marketOk || !(badgeOk || badgeEmpty);
  const value = JSON.stringify(result); itemsCache.set(key, {value, time: Date.now(), complete: !result.transient_error});
  return value;
 };

 // ── social.lua ──
 const previewCache = new TtlCache(96), reviewCache = new TtlCache(64), personaCache = new TtlCache(128), activityCache = new TtlCache(32);
 M.fetch_published_file_previews = async ({file_ids_csv} = {}) => {
  const out = [];
  for (const id of String(file_ids_csv || '').match(/\d+/g) || []) {
   if (out.length >= 12) break;
   const hit = previewCache.get(id); if (hit) { out.push(hit); continue; }
   const r = await httpGet('https://steamcommunity.com/sharedfiles/filedetails/?id=' + id, {headers: {Accept: 'text/html,*/*'}, timeout: 10});
   const entry = {id, image: ''}; const img = r?.status === 200 ? r.body.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1] : null; if (img) entry.image = img.replace(/&amp;/g, '&');
   previewCache.set(id, entry); out.push(entry);
  }
  return JSON.stringify(out);
 };
 const strip = s => htmlUnescape(String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
 M.fetch_friend_review = async (args = {}) => {
  let sid = String(args.steam_id64 ?? args.steamid64 ?? args.id ?? '').match(/\d+/)?.[0] || '', appid = String(args.steam_app_id ?? args.appid ?? '').match(/\d+/)?.[0] || '';
  if (sid.length < 15 && appid.length >= 15) [sid, appid] = [appid, sid];
  const key = sid + '_' + appid, hit = reviewCache.get(key); if (hit) return hit;
  const url = 'https://steamcommunity.com/profiles/' + sid + '/recommended/' + appid + '/', out = {found: false, url};
  if (!isVirtualAppId(appid)) { const r = await httpGet(url + '?l=english', {headers: {Accept: 'text/html,*/*'}, timeout: 10}); if (r?.status === 200) { const rating = r.body.match(/<div class="ratingSummary">\s*([\s\S]*?)\s*<\/div>/)?.[1], play = r.body.match(/<div class="playTime">\s*([\s\S]*?)\s*<\/div>/)?.[1], text = r.body.match(/<div id="ReviewText">([\s\S]*?)<\/div>/)?.[1]; if (rating && text) Object.assign(out, {found: true, voted_up: !rating.toLowerCase().includes('not recommended'), rating: strip(rating), hours: play ? strip(play) : '', text: strip(text)}); } }
  return reviewCache.set(key, JSON.stringify(out));
 };
 M.fetch_friend_personas = async (args = {}) => {
  const raw = typeof args === 'object' ? (args.steam_ids_csv ?? args.ids ?? '') : args, ids = [...new Set(String(raw || '').match(/\d+/g) || [])].slice(0, 32), out = [];
  for (const sid of ids) {
   const hit = personaCache.get(sid); if (hit && hit.expires > Date.now()) { out.push(hit.entry); continue; }
   const r = await httpGet('https://steamcommunity.com/profiles/' + sid + '/?xml=1', {timeout: 8}), entry = {steamid: sid, name: '', avatar: ''};
   if (r?.status === 200) { const b = r.body, cd = tag => b.match(new RegExp('<' + tag + '><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></' + tag + '>'))?.[1] ?? b.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>'))?.[1]; entry.name = cd('steamID') || ''; entry.avatar = cd('avatarMedium') || cd('avatarFull') || cd('avatarIcon') || ''; }
   personaCache.set(sid, {entry, expires: Date.now() + (entry.name || entry.avatar ? 900000 : 60000)}); out.push(entry);
  }
  return JSON.stringify(out);
 };
 M.fetch_community_activity = async (args = {}) => {
  const appid = String(args.steam_app_id ?? args.appid ?? '').match(/\d+/)?.[0] || '', sid = String(args.steam_id64 ?? args.steamid64 ?? '').match(/\d+/)?.[0] || '';
  if ((!appid && !sid) || isVirtualAppId(appid)) return '[]';
  const key = appid + '_' + sid, hit = activityCache.get(key, 30); if (hit) return hit;
  const events = [], seen = new Set(), now = Math.floor(Date.now() / 1000), urls = [];
  if (sid.length >= 15) urls.push('https://steamcommunity.com/profiles/' + sid + '/home/'); if (appid) urls.push('https://steamcommunity.com/app/' + appid + '/home/');
  const processPost = chunk => {
   if (!chunk || (appid && !chunk.includes('app/' + appid))) return;
   const actorSid = chunk.match(/profiles\/(\d+)/)?.[1] || '', name = strip(chunk.match(/<a\s+class="whiteLink"\s+href="[^"]*">([\s\S]*?)<\/a>/)?.[1] || chunk.match(/<span\s+class="persona[^"]*">([\s\S]*?)<\/span>/)?.[1] || chunk.match(/class="blotter_author_block[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] || '');
   const avatar = chunk.match(/<img\s+src="([^"]*avatars[^"]*)"/)?.[1] || chunk.match(/<img\s+src="([^"]*avatar[^"]*)"/)?.[1] || '';
   const status = strip(chunk.match(/<div\s+class="blotter_userstatus_content[^"]*">\s*([\s\S]*?)\s*<\/div>/)?.[1] || chunk.match(/<div\s+class="blotter_status_text[^"]*">\s*([\s\S]*?)\s*<\/div>/)?.[1] || chunk.match(/<blockquote[^>]*>\s*([\s\S]*?)\s*<\/blockquote>/)?.[1] || '');
   const wish = chunk.includes('lista de deseados') || chunk.includes('wishlist');
   if (!actorSid && !name && !status) return;
   const k = actorSid + '_' + status + '_' + (wish ? 1 : 0); if (seen.has(k)) return; seen.add(k);
   if (status) events.push({type: 16, steamid: actorSid, name, avatar, text: status, time: now}); else if (wish) events.push({type: 9, steamid: actorSid, name, avatar, time: now});
  };
  for (const url of urls) { const r = await httpGet(url, {headers: {Accept: 'text/html,*/*'}, timeout: 8}); if (r?.status === 200) { const parts = r.body.split('<div class="blotter_post'); parts.shift(); for (const p of parts) processPost(p); } }
  return activityCache.set(key, JSON.stringify(events));
 };
 return M;
}

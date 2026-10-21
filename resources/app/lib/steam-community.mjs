// Notícias e conteúdo da comunidade de jogos vinculados a um AppID da Steam.
// Rotas públicas estudadas no NativeGameLink for Steam (MIT): ISteamNews/GetNewsForApp e o
// "homecontent" do hub da comunidade (capturas, artes, guias e vídeos). Sem chave de API.
const LANG = {'pt-BR': 'brazilian', en: 'english', es: 'spanish', fr: 'french', de: 'german'};
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const IMAGE_HOSTS = /^https:\/\/(images\.steamusercontent\.com|steamuserimages-a\.akamaihd\.net|clan\.akamai\.steamstatic\.com|clan\.cloudflare\.steamstatic\.com|clan\.fastly\.steamstatic\.com|shared\.fastly\.steamstatic\.com|shared\.akamai\.steamstatic\.com|cdn\.akamai\.steamstatic\.com|cdn\.cloudflare\.steamstatic\.com|img\.youtube\.com|i\.ytimg\.com|avatars\.akamai\.steamstatic\.com|avatars\.fastly\.steamstatic\.com|avatars\.cloudflare\.steamstatic\.com|steamcdn-a\.akamaihd\.net)\//;
const LINK_HOSTS = /^https:\/\/(store\.steampowered\.com|steamcommunity\.com|www\.youtube\.com|youtube\.com|youtu\.be)\//;
export const steamLanguage = language => LANG[language] || 'english';
const unescapeHTML = s => String(s || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
const clean = s => unescapeHTML(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
export const safeImage = u => IMAGE_HOSTS.test(String(u || '')) ? String(u) : '';
export const safeLink = u => LINK_HOSTS.test(String(u || '')) ? String(u) : '';

// Notícias oficiais (anúncios e lançamento) do AppID.
export function parseNews(raw) {
 const items = raw?.appnews?.newsitems;
 if (!Array.isArray(items)) return [];
 return items.flatMap(it => {
  let url = String(it.url || '');
  url = url.replace(/^https?:\/\/steamstore-a\.akamaihd\.net(?=\/news\/externalpost\/)/, 'https://store.steampowered.com');
  const feed = String(it.feedname || '');
  if (!/^(steam_community_announcements|steam_release|steam_store_release_metadata|)$/.test(feed) || !safeLink(url)) return [];
  const contents = String(it.contents || '');
  const img = contents.match(/\{STEAM_CLAN_IMAGE\}\/([^\s"'\[\]]+\.(?:png|jpe?g|gif|webp))/i)?.[1];
  const direct = contents.match(/\[img\](https:[^\[]+)\[\/img\]/i)?.[1] || contents.match(/<img[^>]+src="(https:[^"]+)"/i)?.[1];
  const image = safeImage(img ? 'https://clan.akamai.steamstatic.com/images/' + img : direct || '');
  const summary = clean(contents.replace(/\[img\][\s\S]*?\[\/img\]/gi, ' ').replace(/https?:\/\/\S+\.(?:png|jpe?g|gif|webp)\b/gi, ' ').replace(/\[\/?[a-z0-9*]+(?:=[^\]]*)?\]/gi, ' ').replace(/\{STEAM_CLAN_IMAGE\}\S*/g, '')).slice(0, 320);
  const title = clean(it.title).slice(0, 200);
  if (!title) return [];
  const kind = /patch|hotfix|update|atualiza|actualiza|mise à jour|aktualis/i.test(title) ? 'update' : 'news';
  return [{id: String(it.gid || url), title, url, date: new Date(Number(it.date) * 1000).toISOString(), image, summary, kind}];
 }).slice(0, 30);
}

// Cartões do hub da comunidade: capturas, artes, guias e vídeos.
export function parseCommunity(html) {
 const out = [], seen = new Set(), text = String(html || '');
 const parts = text.split(/(?=<div[^>]+class="apphub_Card\b)/);
 for (const card of parts) {
  if (!/class="apphub_Card\b/.test(card)) continue;
  const item = {};
  const yt = card.match(/data-youtube-id="([\w-]{6,20})"/)?.[1] || card.match(/(?:img\.youtube\.com|ytimg\.com)\/vi\/([\w-]{6,20})/)?.[1];
  const type = clean(card.match(/apphub_CardContentType[^>]*>([^<]+)</)?.[1] || '').toLowerCase();
  item.type = yt || /video|vídeo/.test(type) ? 'video' : /guide|guia|guía|leitfaden/.test(type) || /apphub_CardContentGuide/.test(card) ? 'guide' : /artwork|arte|illustration|kunst/.test(type) ? 'artwork' : 'screenshot';
  item.image = safeImage(card.match(/apphub_CardContentPreviewImage"\s+src="([^"]+)"/)?.[1] || card.match(/apphub_CardContentGuideImage"\s+src="([^"]+)"/)?.[1] || card.match(/apphub_CardContentVideoImage"\s+src="([^"]+)"/)?.[1] || (yt ? 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg' : '') || card.match(/<img[^>]+src="(https:\/\/images\.steamusercontent\.com\/[^"]+)"/)?.[1] || '');
  const link = unescapeHTML(card.match(/data-modal-content-url="([^"]+)"/)?.[1] || card.match(/href="([^"]*sharedfiles\/filedetails[^"]*)"/)?.[1] || '');
  item.link = safeLink(link) || (card.match(/data-publishedfileid="(\d+)"/) ? 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + card.match(/data-publishedfileid="(\d+)"/)[1] : '');
  if (yt) item.youtube = yt;
  item.title = clean(card.match(/apphub_CardContentTitle[^>]*>([\s\S]*?)<\/div>/)?.[1] || card.match(/apphub_CardContentGuideTitle[^>]*>([\s\S]*?)<\/div>/)?.[1] || '').slice(0, 160);
  item.description = clean(card.match(/apphub_CardContentGuideDesc[^>]*>([\s\S]*?)<\/div>/)?.[1] || '').slice(0, 400);
  item.author = clean(card.match(/apphub_CardContentAuthorName[\s\S]*?<a[^>]*>([^<]*)<\/a>/)?.[1] || '').slice(0, 80);
  item.avatar = safeImage(card.match(/appHubIconHolder[^>]*>\s*<img src="([^"]+)"/)?.[1] || '');
  const key = item.link || item.image;
  if (!item.image || !key || seen.has(key)) continue;
  seen.add(key); out.push(item);
  if (out.length >= 48) break;
 }
 return out;
}

export class SteamCommunity {
 constructor({request, requestText, language = () => 'pt-BR'}) { Object.assign(this, {request, requestText, language}); this.cache = new Map(); }
 async cached(key, ttl, fn) { const old = this.cache.get(key); if (old && Date.now() - old.at < ttl) return old.value; try { const value = await fn(); this.cache.set(key, {at: Date.now(), value}); if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value); return value; } catch (e) { if (old) return old.value; throw e; } }
 news(appId) {
  appId = Number(appId); if (!Number.isInteger(appId) || appId <= 0) return Promise.resolve([]);
  const l = steamLanguage(this.language());
  return this.cached('news:' + appId + ':' + l, 1800000, async () => parseNews(await this.request('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?' + new URLSearchParams({appid: appId, count: 30, maxlength: 900, format: 'json', feeds: 'steam_community_announcements,steam_release', l}))));
 }
 community(appId) {
  appId = Number(appId); if (!Number.isInteger(appId) || appId <= 0) return Promise.resolve([]);
  const l = steamLanguage(this.language());
  return this.cached('hub:' + appId + ':' + l, 3600000, async () => {
   const items = [];
   const add = list => { for (const it of list) if (!items.some(x => (x.link || x.image) === (it.link || it.image))) items.push(it); };
   const page = (lang, extra = '') => this.requestText('https://steamcommunity.com/app/' + appId + '/homecontent/?' + new URLSearchParams({l: lang, browsefilter: 'trend', numperpage: '30', p: '1', appid: String(appId), forceanon: '1'}) + extra, {headers: {'User-Agent': UA, Accept: 'text/html,*/*', Cookie: 'Steam_Language=' + lang + '; birthtime=0; mature_content=1'}}).then(parseCommunity).catch(() => []);
   add(await page(l));
   add(await page(l, '&appHubSubSection=9'));
   if (items.length < 18 && l !== 'english') { add(await page('english')); add(await page('english', '&appHubSubSection=9')); }
   return items.slice(0, 36);
  });
 }
}

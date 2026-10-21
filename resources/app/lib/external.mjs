import {titleKey} from './metadata.mjs';
import {platformByKey,platformByName,PLATFORMS} from './platforms.mjs';
import {scoreCandidate} from './title-match.mjs';
export const EXTERNAL_PLATFORMS=['PlayStation Portable','PlayStation 3','PlayStation 2','PlayStation','PC (Microsoft Windows)','Nintendo GameCube','Wii','Nintendo Switch','Não informada'];
// Tipos da IGDB que não são o jogo em si (DLC, pacotes, atualizações etc.).
const SKIP_TYPES=new Set(['DLC','Expansion','Bundle','Mod','Season','Pack','Update','Fork']);
const SKIP_CATEGORY=new Set([1,2,3,5,7,13,14]);
const typeOf=g=>g.game_type?.type||null;
export function isMainEntry(g){const t=typeOf(g);if(t)return !SKIP_TYPES.has(t);return !SKIP_CATEGORY.has(Number(g.category));}
const yearOf=g=>g?.first_release_date?new Date(g.first_release_date*1000).getUTCFullYear():null;
// Agrupa e ordena resultados: um cartão por jogo, versões/edições recolhidas no jogo principal,
// e a plataforma detectada (quando conhecida) separa "desta plataforma" de "outras plataformas".
export function externalResults(found,{platformKey=null,query=''}={}){
 const platform=platformKey?platformByKey(platformKey):null;
 const results=[];const used=new Set(),ids=new Set((found.igdb||[]).map(g=>g.id));
 for(const igdb of found.igdb||[]){
  if(!igdb.id||!igdb.name||!isMainEntry(igdb))continue;
  // Edição/versão cujo jogo principal também veio na busca: mostra só o principal.
  if(igdb.version_parent&&ids.has(Number(igdb.version_parent?.id??igdb.version_parent)))continue;
  const names=[igdb.name,...(igdb.alternative_names||[]).map(a=>a.name)].map(titleKey);const matching=(found.sgdb||[]).filter(s=>names.includes(titleKey(s.name)));const sgdb=matching.length===1?matching[0]:null;if(sgdb)used.add(String(sgdb.id));
  const platforms=(igdb.platforms||[]).filter(p=>p.name&&p.id).map(p=>({id:String(p.id),name:p.name}));
  const platformMatch=platform?platforms.some(p=>Number(p.id)===platform.igdb||platformByName(p.name)?.key===platform.key):null;
  const scored=query?scoreCandidate(query,igdb.name,{platformMatch,aliases:(igdb.alternative_names||[]).map(a=>a.name)}):{score:0};
  results.push({name:igdb.name,igdb,sgdb,platforms:platforms.length?platforms:EXTERNAL_PLATFORMS.map(name=>({id:name,name})),platformMatch,score:scored.score,exact:!!scored.exact,year:yearOf(igdb),popularity:Number(igdb.total_rating_count)||0});
 }
 for(const sgdb of found.sgdb||[]){if(!sgdb.id||!sgdb.name||used.has(String(sgdb.id)))continue;const scored=query?scoreCandidate(query,sgdb.name,{}):{score:0};results.push({name:sgdb.name,sgdb,platforms:EXTERNAL_PLATFORMS.map(name=>({id:name,name})),platformMatch:null,score:Math.max(0,scored.score-.05),exact:!!scored.exact,year:sgdb.release_date?new Date(sgdb.release_date*1000).getUTCFullYear():null,popularity:0});}
 for(const free of found.free||[]){const p=platformByKey(free.platformKey);results.push({name:free.name,free,platforms:p?[{id:p.name,name:p.name}]:EXTERNAL_PLATFORMS.map(name=>({id:name,name})),platformMatch:p?(platform?p.key===platform.key:null):null,score:free.score||0,exact:(free.score||0)>=1,year:null,popularity:0});}
 if(query)results.sort((a,b)=>(b.platformMatch===true)-(a.platformMatch===true)||b.score-a.score||b.popularity-a.popularity);
 return results.slice(0,30);
}
// Capa da busca: IGDB em alta resolução; sem capa na IGDB, usa a capa oficial da Steam pelo ID externo.
export function steamIdOf(igdb){const row=(igdb?.external_games||[]).find(e=>(Number(e.category)===1||Number(e.external_game_source)===1||Number(e.external_game_source?.id)===1)&&/^\d{1,9}$/.test(String(e.uid||'')));return row?Number(row.uid):null;}
export function externalPreview(item){try{if(item.free?.url)return item.free.url;const raw=item.igdb?.cover?.url||'';if(raw){const u=new URL(raw.startsWith('//')?'https:'+raw:raw);if(u.protocol==='https:'&&u.hostname==='images.igdb.com')return u.href.replace(/\/t_[a-z0-9_]+\//,'/t_cover_big_2x/');}const steam=steamIdOf(item.igdb);return steam?'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/'+steam+'/library_600x900.jpg':'';}catch{return '';}}
// Plataforma mais provável de um resultado para o arquivo importado.
export function preferredPlatform(item,platformKey){const p=platformKey?platformByKey(platformKey):null;if(!p)return null;return (item.platforms||[]).find(x=>Number(x.id)===p.igdb||platformByName(x.name)?.key===p.key)||null;}
export {PLATFORMS};

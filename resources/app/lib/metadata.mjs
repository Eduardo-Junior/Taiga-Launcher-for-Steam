import {normalize} from './files.mjs';
import {DEMOS} from './demos.mjs';
import {randomInt} from 'node:crypto';
import {platformByName} from './platforms.mjs';
export const titleKey=value=>normalize(String(value||'').replace(/\s*[([]\d{4}[)\]]\s*$/,''));
export const needsMetadata=g=>!g.metadata?.summary||!g.metadata?.release||!g.platformName||g.platformName==='Não informada';
export function applyIGDB(game,source){
 if(!game.demo&&!game.platformName)game.platformName='PlayStation Portable';
 const platforms=(source.platforms||[]).filter(p=>p.id&&p.name);
 if(game.demo&&(!game.platformName||game.platformName==='Não informada')&&platforms.length){const preferred=['PC (Microsoft Windows)','PlayStation 3','PlayStation Portable'];const p=preferred.map(name=>platforms.find(p=>p.name===name)).find(Boolean)||platforms[0];game.platformName=p.name;game.platformId=p.id;game.platformInferred=true;}
 const wanted=platformByName(game.platformName),platformId=game.platformId||platforms.find(p=>p.name===game.platformName)?.id||(wanted&&platforms.find(p=>Number(p.id)===wanted.igdb||platformByName(p.name)?.key===wanted.key)?.id);
 const dates=(source.release_dates||[]).filter(r=>String(r.platform)===String(platformId)&&Number.isFinite(r.date)&&r.date>0).map(r=>r.date);
 const stamp=dates.length?Math.min(...dates):Number(source.first_release_date)||0;
 return {summary:source.summary||source.storyline||'',summaryLanguage:'en',developer:(source.involved_companies||[]).filter(x=>x.developer).map(x=>x.company.name).join(', '),publisher:(source.involved_companies||[]).filter(x=>x.publisher).map(x=>x.company.name).join(', '),release:stamp&&Number.isFinite(new Date(stamp*1000).valueOf())?new Date(stamp*1000).toISOString().slice(0,10):'',releaseBasis:dates.length?'Lançamento da plataforma selecionada':'Primeiro lançamento do título disponível na IGDB',genres:(source.genres||[]).map(x=>x.name),series:[...(source.collections||[]),...(source.franchises||[])].map(x=>x?.name).filter(Boolean)[0]||'',url:source.url||''};
}
export function ensureDemoSize(game){if(!game.demo||Number(game.bytes)>0)return false;const reference=DEMOS.find(g=>titleKey(g.title)===titleKey(game.title));if(reference){game.bytes=reference.bytes;game.sizeApproximate=!!reference.sizeApproximate;game.sizeBasis=reference.sizeBasis+(game.platformName!==reference.platformName?' · referência de '+reference.platformName:'');delete game.sizeSynthetic;return true;}const [min,max]=game.platformName==='PlayStation Portable'?[200,1801]:game.platformName==='PlayStation 3'?[5000,40001]:[500,30001];game.bytes=randomInt(min,max)*1024**2;game.sizeSynthetic=true;game.sizeApproximate=false;game.sizeBasis='Tamanho ilustrativo gerado aleatoriamente para este cadastro sem arquivo. Não corresponde ao tamanho real do jogo.';return true;}

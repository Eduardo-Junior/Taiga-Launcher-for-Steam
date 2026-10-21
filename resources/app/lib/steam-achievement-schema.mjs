import fs from 'node:fs';import path from 'node:path';import {parseVDF} from './vdf.mjs';
export function nativeAchievementSchema(steamDir,appid){
 const file=path.join(steamDir||'','appcache','stats','UserGameStatsSchema_'+appid+'.bin');try{if(fs.statSync(file).size>4*1024*1024)return null;const object=nodes=>Object.fromEntries(nodes.map(n=>[n.key,n.type===0?object(n.value):Buffer.isBuffer(n.value)?(n.value.length===4?n.value.readUInt32LE():0):n.value])),root=object(parseVDF(fs.readFileSync(file))),schema=root[String(appid)],rows=[];if(!schema?.stats)return null;
 for(const [statId,stat] of Object.entries(schema.stats))for(const [bitId,bit] of Object.entries(stat?.bits||{})){if(!bit?.name||!bit.display)continue;const d=bit.display;rows.push({name:bit.name,displayName:d.name,description:d.desc,icon:steamIcon(appid,d.icon),icongray:steamIcon(appid,d.icon_gray),hidden:d.hidden===1||d.hidden===true||d.hidden==='1',statId,bit:Number(bit.bit??bitId)});if(rows.length>10000)return null;}return rows.length?{achievements:rows}:null;
 }catch{return null;}
}
export function steamIcon(appid,value){if(!value)return '';if(/^https:\/\//.test(value))return value;const name=path.basename(String(value).replaceAll('\\','/'));if(!/^[a-zA-Z0-9_.-]+$/.test(name))return '';return 'https://shared.fastly.steamstatic.com/community_assets/images/apps/'+appid+'/'+name+(name.includes('.')?'':'.jpg');}
export function publicAchievementSchema(raw,appid,language){const list=raw?.response?.achievements;if(!Array.isArray(list)||list.length>10000)return null;const seen=new Set(),achievements=[];for(const a of list){if(typeof a.internal_name!=='string'||seen.has(a.internal_name))continue;seen.add(a.internal_name);achievements.push({name:a.internal_name,displayName:a.localized_name||a.internal_name,description:a.localized_desc||'',icon:steamIcon(appid,a.icon),icongray:steamIcon(appid,a.icon_gray),hidden:a.hidden===true,globalPercent:a.player_percent_unlocked!==undefined&&a.player_percent_unlocked!==null&&a.player_percent_unlocked!==''&&Number.isFinite(Number(a.player_percent_unlocked))?Math.max(0,Math.min(100,Number(a.player_percent_unlocked))):null,maxProgress:Number(a.max_progress_int)||null});}return achievements.length?{language,achievements}:null;}

// Progresso nativo gravado pela própria Steam (sem chave de API): appcache/stats/UserGameStats_<conta>_<appid>.bin.
// Cada estatística de conquista guarda um campo "data" com um bit por conquista e "AchievementTimes" com a data.
export function nativeUserProgress(steamDir,accountId,appid,schema=nativeAchievementSchema(steamDir,appid)){
 if(!schema||!accountId)return null;const file=path.join(steamDir||'','appcache','stats','UserGameStats_'+accountId+'_'+appid+'.bin');
 try{if(fs.statSync(file).size>4*1024*1024)return null;const object=nodes=>Object.fromEntries(nodes.map(n=>[n.key,n.type===0?object(n.value):Buffer.isBuffer(n.value)?(n.value.length===4?n.value.readUInt32LE():n.value.length===8?Number(n.value.readBigUInt64LE()):0):n.value]));
  const root=object(parseVDF(fs.readFileSync(file))),stats=root.cache||root[String(appid)]||root,state={};let known=0;
  for(const a of schema.achievements){if(a.statId===undefined||!Number.isInteger(a.bit))continue;const s=stats[a.statId]||stats[String(a.statId)];if(!s||typeof s!=='object')continue;known++;const data=Number(s.data)>>>0,earned=((data>>>a.bit)&1)===1,time=Number(s.AchievementTimes?.[String(a.bit)])||0;state[a.name]={earned:earned?1:0,...(earned&&time?{earned_time:time}:{})};}
  return known?{state,file}:null;
 }catch{return null;}
}

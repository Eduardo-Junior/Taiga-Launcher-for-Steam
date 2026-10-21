// TaigaSteam 1.4.8, jogos do TaigaSteam no perfil da Comunidade Steam, login da Epic e textos da página.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createCommunity} from '../lib/community.mjs';
import {targetKind} from '../lib/steam-inject.mjs';
import {authorizationCode,exchangeCode,validSession} from '../lib/epic-auth.mjs';
import {StoreAchievements} from '../lib/store-achievements.mjs';
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-148-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};

test('Community data: only games added to Steam by TaigaSteam, local art as data: URLs, Steam art from the CDN',async t=>{
 const dir=tmp(t),art=path.join(dir,'art');fs.mkdirSync(art);fs.writeFileSync(path.join(art,'aa11.png'),Buffer.from('89504e470d0a1a0a','hex'));
 const games=[{uuid:'u1',title:'God of War',bindings:{'7':3000000001},art:{wide:'aa11.png'}},{uuid:'u2',title:'FNAF',bindings:{'7':2915423700},metadataSteamAppId:2638370,art:{}},{uuid:'u3',title:'Não enviado',bindings:{},art:{}},{uuid:'u4',title:'Oculto',hidden:true,bindings:{'7':5}}];
 const ach={u1:{achievements:[{id:'a',title:'A',unlocked:true,date:new Date().toISOString(),icon:'http://127.0.0.1:48767/art/aa11.png'},{id:'b',title:'B',unlocked:true,date:'2020-01-01T00:00:00Z',icon:'https://media.retroachievements.org/b.png'}]}};
 const c=createCommunity({games:()=>games,account:()=>'7',steamId:()=>'76561198000000001',steamAppIdOf:g=>g.metadataSteamAppId||null,virtualAppIdOf:()=>1900000001,playtimeOf:(g,sid)=>sid===3000000001?{seconds_forever:3600,seconds_last_two_weeks:600,last_played_at:Math.floor(Date.now()/1000)-60}:{},achievementsOf:async g=>ach[g.uuid]||{achievements:[]},cachedAchievementsOf:g=>ach[g.uuid]||null,artDir:art,port:48767});
 const r=await c.games();
 assert.equal(r.steamId,'76561198000000001');assert.deepEqual(r.games.map(g=>g.uuid),['u1','u2']);
 const gow=r.games[0];assert.equal(gow.minutes,60);assert.equal(gow.recent,true);assert.equal(gow.achievements.perfect,true);assert.equal(gow.achievements.recentIcons.length,1);assert.match(gow.achievements.recentIcons[0].icon,/^data:image\/png;base64,/);
 assert.match((await c.image({uuid:'u1',kind:'header'})).url,/^data:image\/png/);
 assert.equal((await c.image({uuid:'u2',kind:'header'})).url,'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2638370/header.jpg');
 assert.equal((await c.image({uuid:'u3',kind:'header'})).url,'');
 const a=await c.achievements({uuid:'u1'});assert.equal(a.achievements.length,2);assert.match(a.achievements[0].icon,/^data:/);assert.equal(a.achievements[1].icon,'https://media.retroachievements.org/b.png');
 await assert.rejects(c.achievements({uuid:'u3'}));
});

test('Community pages of the profile are injection targets; other sites are not',()=>{
 assert.equal(targetKind({type:'page',title:'GabrielTaiga',url:'https://steamcommunity.com/id/TaigaOficial/games/?tab=all'}),'community');
 assert.equal(targetKind({type:'page',title:'x',url:'https://steamcommunity.com/profiles/76561198000000001/'}),'community');
 assert.equal(targetKind({type:'page',title:'x',url:'https://store.steampowered.com/app/10'}),null);
 assert.equal(targetKind({type:'page',title:'x',url:'https://steamcommunity.evil.com/id/x'}),null);
});

test('The community page can only ask for its three read-only requests',async t=>{
 const dir=tmp(t);fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({language:'pt-BR',languageChosen:true,roots:[]}));
 const {createApp}=await import('../server.mjs');const app=createApp({dataDir:dir,port:0});t.after(()=>app.server.close());
 const onCall=app.injector.onCall;
 await assert.rejects(onCall('factory_reset',{},'community'),/Não permitido/);
 await assert.rejects(onCall('get_all_mappings',{},null),/Não permitido/);
 assert.equal(JSON.parse(await onCall('community_games',{},'community')).games.length,0);
 assert.ok(await onCall('get_all_mappings',{},'shared'));
 const {community}=await app.injector.scripts();assert.match(community,/__TAIGA_COMMUNITY_FALLBACK__/);assert.match(community,/taiga-community-games/);
});

test('Epic sign-in: code from the redirect page, token exchange and refresh (SuccessStory route)',async()=>{
 assert.equal(authorizationCode('{"warning":"x","redirectUrl":"https://localhost/launcher/authorized?code=x","authorizationCode":"0123456789abcdef0123456789abcdef","exchangeCode":null,"sid":null}'),'0123456789abcdef0123456789abcdef');
 assert.equal(authorizationCode('<html>login</html>'),null);
 const calls=[];const fetchImpl=async(url,o)=>{calls.push([url,o.headers.Authorization,o.body]);return {ok:true,status:200,text:async()=>JSON.stringify({access_token:'tok',token_type:'bearer',expires_in:7200,refresh_token:'ref',refresh_expires:86400,account_id:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',displayName:'Gabriel'})};};
 const s=await exchangeCode('0123456789abcdef0123456789abcdef',fetchImpl);
 assert.equal(s.accountId,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');assert.equal(s.displayName,'Gabriel');assert.match(calls[0][0],/account-public-service-prod03\.ol\.epicgames\.com\/account\/api\/oauth\/token$/);assert.match(calls[0][1],/^basic /);assert.match(calls[0][2],/grant_type=authorization_code/);
 let saved=null;const again=await validSession({...s,expiresAt:Date.now()-1},{fetchImpl,save:n=>{saved=n;}});assert.equal(again.accessToken,'tok');assert.ok(saved);assert.match(calls[1][2],/grant_type=refresh_token/);
 assert.equal(await validSession({...s,expiresAt:Date.now()-1,refreshToken:''},{fetchImpl}),null);
});

test('Epic progress of a private profile is read with the sign-in token',async t=>{
 const seen=[];const fetchImpl=async(url,opt)=>{const body=JSON.parse(opt.body);seen.push(opt.headers.Authorization||'');
  if(/query Achievement/.test(body.query))return {ok:true,status:200,text:async()=>JSON.stringify({data:{Achievement:{productAchievementsRecordBySandbox:{productId:'p',achievements:[{achievement:{name:'A1',unlockedDisplayName:'Um',unlockedDescription:'d'}}]}}}})};
  if(!opt.headers.Authorization)return {ok:true,status:200,text:async()=>JSON.stringify({data:{PlayerProfile:{playerProfile:{productAchievements:null}}}})};
  return {ok:true,status:200,text:async()=>JSON.stringify({data:{PlayerProfile:{playerProfile:{productAchievements:{data:{playerAchievements:[{playerAchievement:{achievementName:'A1',unlocked:true,unlockDate:'2026-10-01T00:00:00.000Z'}}]}}}}}})};};
 const s=new StoreAchievements({dir:tmp(t),fetchImpl});
 const r=await s.epic({namespace:'ns',accountId:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',language:'en',auth:{type:'bearer',accessToken:'tok'}});
 assert.equal(r.status,'ok');assert.equal(r.achievements[0].unlocked,true);assert.ok(seen.includes('bearer tok'));
});

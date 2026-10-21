// TaigaSteam 1.5.0, tradução sem cota curta, perfil para amigos (sem servidor por padrão) e tela inicial.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {googleTranslate} from '../lib/translation.mjs';
import {createPublicProfile,sanitizeProfile,profileServerUrl} from '../lib/public-profile.mjs';
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-150-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
const SID='76561198000000001';

test('Google translation (gtx) joins the translated parts and detects the source language',async()=>{
 let url='';const r=await googleTranslate('Defeat the boss.','pt-BR','auto',async u=>{url=u;return {ok:true,json:async()=>[[['Derrote ','Defeat ',null],['o chefe.','the boss.',null]],null,'en']};});
 assert.equal(r,'Derrote o chefe.');const q=new URL(url).searchParams;assert.equal(q.get('sl'),'auto');assert.equal(q.get('tl'),'pt');assert.equal(q.get('client'),'gtx');
 await assert.rejects(googleTranslate('x','de','en',async()=>({ok:false,status:429})));
});

test('Friend profile: nothing leaves the PC without a server; local file is written; friend data is sanitized',async t=>{
 const dir=tmp(t),config={profileServer:'',profileKey:''},calls=[];
 const profile={v:1,app:'TaigaSteam',steamId:SID,language:'pt-BR',games:[{uuid:'u1',title:'God of War',steamAppId:null,minutes:60,lastPlayed:1,recent:false,achievements:{total:2,unlocked:2,perfect:true,recentIcons:[]},images:{header:'https://cdn2.steamgriddb.com/x.png',cover:'',hero:''},achievementList:[{title:'A',unlocked:true,date:'2026-10-01T00:00:00Z',icon:'https://media.retroachievements.org/a.png'}]}]};
 const pp=createPublicProfile({dir,config:()=>config,build:async()=>profile,fetchImpl:async(u,o)=>{calls.push([u,o?.method||'GET']);return {ok:true,text:async()=>JSON.stringify(profile)};}});
 assert.equal((await pp.refresh()).published,false);assert.equal(calls.length,0);assert.ok(fs.existsSync(path.join(dir,'public-profile.json')));
 assert.deepEqual(await pp.friend(SID),{games:[]});assert.equal(calls.length,0);
 config.profileServer=profileServerUrl('https://perfis.example.workers.dev/');config.profileKey='a'.repeat(48);
 assert.equal((await pp.refresh({force:true})).published,true);assert.deepEqual(calls[0],['https://perfis.example.workers.dev/v1/profiles/'+SID,'PUT']);
 const f=await pp.friend(SID);assert.equal(f.games[0].title,'God of War');assert.equal(f.games[0].uuid,'friend-u1');assert.equal(f.games[0].achievements.perfect,true);
 await pp.friend(SID);assert.equal(calls.filter(c=>c[1]==='GET').length,1,'cache de 10 min');
 assert.throws(()=>profileServerUrl('http://inseguro.example'));
 assert.equal(sanitizeProfile({...profile,steamId:'76561198000000002'},SID),null,'perfil de outra pessoa é ignorado');
 const bad=sanitizeProfile({...profile,games:[{title:'<b>x</b>',images:{header:'javascript:alert(1)'},achievements:{total:3,unlocked:9},achievementList:[{title:'t',icon:'file:///c:/x.png'}]}]},SID);
 assert.equal(bad.games[0].images.header,'');assert.equal(bad.games[0].achievements.unlocked,3);assert.equal(bad.games[0].achievementList[0].icon,'');
});

test('Onboarding shows the account picker with photos and hides "later" when Steam was found',async()=>{
 const src=fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const fn=src.slice(src.indexOf('function renderOnboarding(){'),src.indexOf('\nasync function pickSetting'));
 assert.match(fn,/ob2-accounts/);assert.match(fn,/a\.avatar/);assert.match(fn,/found\?`<button class="btn btn-primary btn-lg" data-act="ob-next"/);assert.match(fn,/data-act="ob2-auto"/);assert.match(fn,/data-act="ob2-folder"/);
 for(const l of ['pt-BR','en','es','fr','de']){const d=JSON.parse(fs.readFileSync(new URL('../locales/'+l+'.json',import.meta.url),'utf8'));for(const k of ['ob.title','ob.scan','ob.whichAccount','steamConfirm.title','friends.title','autoSync.label'])assert.ok(d[k],l+' '+k);}
});

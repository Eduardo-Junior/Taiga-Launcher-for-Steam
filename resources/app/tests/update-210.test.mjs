// Taiga Launcher 2.1.0, logins protegidos, atualização automática, ID da loja → Steam, PlayStation, tempo de jogo,
// remover tudo da Steam e pasta de dados nova.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {openSecrets,sealSecrets} from '../lib/secret-box.mjs';
import {newer,latestRelease,updateScript} from '../lib/updater.mjs';
import {steamIdFromStore} from '../lib/store-steam-id.mjs';
import {psnTrophies,psnFromNpsso} from '../lib/psn.mjs';
import {playnitePlaytime,applyImported} from '../lib/playtime-import.mjs';
import {SessionStore} from '../lib/launch-engine.mjs';
import {collectionDelete} from '../lib/steam-collections.mjs';
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-210-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
const write=(f,c)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c);return f;};
const res=(data,status=200,headers={})=>({ok:status>=200&&status<300,status,headers:new Map(Object.entries(headers)),json:async()=>data});

test('Saved logins and keys are encrypted on disk and read back; without the protection nothing changes', () => {
 const box={available:()=>true,encrypt:s=>Buffer.from(s).reverse().toString('base64'),decrypt:b=>Buffer.from(b,'base64').reverse().toString()};
 const config={language:'pt-BR',epicAuth:{accessToken:'a',accountId:'b'},raToken:'tok',own_sgdbKey:'K',steamDir:'C:\\Steam'};
 const sealed=sealSecrets(config,box);
 assert.match(sealed.epicAuth,/^enc:v1:/);assert.match(sealed.raToken,/^enc:v1:/);assert.match(sealed.own_sgdbKey,/^enc:v1:/);assert.equal(sealed.steamDir,'C:\\Steam');assert.equal(sealed.language,'pt-BR');
 assert.ok(!JSON.stringify(sealed).includes('"tok"'));
 const back=openSecrets(JSON.parse(JSON.stringify(sealed)),box);assert.deepEqual(back.epicAuth,{accessToken:'a',accountId:'b'});assert.equal(back.raToken,'tok');assert.equal(back.own_sgdbKey,'K');
 assert.deepEqual(sealSecrets(config,null),config,'sem proteção disponível, grava como antes');
 const broken=openSecrets({epicAuth:'enc:v1:@@@',raToken:'enc:v1:@@@'},{available:()=>true,decrypt:()=>{throw Error('outro usuário');}});assert.equal(broken.epicAuth,null);assert.equal(broken.raToken,'');
});

test('Updater: version compare, latest release from GitHub, update script keeps keys and data', async () => {
 assert.equal(newer('2.1.0','2.0.9'),true);assert.equal(newer('v2.0.0','2.0.0'),false);assert.equal(newer('2.0.0','2.1.0'),false);
 const rel=await latestRelease('taiga/launcher',{fetchImpl:async url=>{assert.equal(url,'https://api.github.com/repos/taiga/launcher/releases/latest');return res({tag_name:'v2.1.0',body:'Novidades',html_url:'https://github.com/taiga/launcher/releases/tag/v2.1.0',assets:[{name:'Taiga Launcher 2.1.0.zip',browser_download_url:'https://github.com/taiga/launcher/releases/download/v2.1.0/x.zip',size:10}]});}});
 assert.equal(rel.version,'2.1.0');assert.match(rel.url,/x\.zip$/);
 assert.equal(await latestRelease('não é repo'),null);
 const ps=updateScript({zip:"C:\\Users\\a'b\\up.zip",installDir:'D:\\Jogos\\Taiga Launcher',pid:123});
 assert.match(ps,/\/XF chaves\.json/);assert.match(ps,/Wait-Process -Id \$procId/);assert.match(ps,/'C:\\Users\\a''b\\up\.zip'/);assert.match(ps,/Remove-Item -LiteralPath \$old/);
});

test('Store ID → Steam AppID through IGDB external games (no name matching)', async () => {
 const queries=[];
 const providers={igAvailable:()=>true,sgAvailable:()=>false,ig:async q=>{queries.push(q);return [{id:1,name:'Grand Theft Auto V Enhanced',external_games:[{category:26,uid:'9d2d0eb64d5c44529cece33fe2a46482'},{category:1,uid:'3240220'}]},{id:2,name:'Outro',external_games:[{category:1,uid:'1'}]}];}};
 const r=await steamIdFromStore({title:'GTA V',store:{name:'epic',id:'9d2d0eb64d5c44529cece33fe2a46482',namespace:'0584d2013f0149a791e7b9bad0eec102',appName:'8769e24080ea413b8ebca3f1b8c50951'}},providers);
 assert.deepEqual([r.appId,r.source],[3240220,'igdb']);assert.match(queries[0],/external_games\.uid = \(/);
 assert.equal(await steamIdFromStore({title:'x',store:{name:'epic',id:'nada-aqui'}},{igAvailable:()=>true,sgAvailable:()=>false,ig:async()=>[]}),null);
 assert.equal(await steamIdFromStore({title:'x'},providers),null,'sem loja, nada');
 const sg=await steamIdFromStore({title:'x',store:{name:'epic',id:'abc123'}},{igAvailable:()=>false,sgAvailable:()=>true,sg:async e=>e.startsWith('games/egs/')?[{id:77}]:[{id:77,name:'Jogo',external_platform_data:{steam:[{id:'4242'}]}}]});
 assert.deepEqual([sg.appId,sg.source],[4242,'sgdb']);
});

test('PlayStation: npsso → token, official trophy names in the program language and trophies already earned', async () => {
 const seen=[];
 const fetchImpl=async(url,opt={})=>{seen.push([url,opt.headers?.['Accept-Language']]);
  if(url.includes('/authorize?'))return res({},302,{location:'com.scee.psxandroid.scecompcall://redirect/?code=v3.ABC'});
  if(url.endsWith('/token'))return res({access_token:'AT',refresh_token:'RT',expires_in:3600,refresh_token_expires_in:5184000});
  if(url.includes('/users/me/'))return res({trophies:[{trophyId:1,earned:true,earnedDateTime:'2015-07-20T10:00:00Z'},{trophyId:2,earned:false}]});
  if(url.includes('npServiceName=trophy&')||url.endsWith('npServiceName=trophy'))return res({trophies:[{trophyId:0,trophyType:'platinum',trophyName:'Rei do Olimpo',trophyDetail:'Todos os troféus'},{trophyId:1,trophyType:'bronze',trophyName:'Abrindo as comportas',trophyDetail:'Mate Poseidon'},{trophyId:2,trophyType:'silver',trophyName:'Mão',trophyDetail:'Sala secreta',trophyHidden:true}]});
  return res({},404);};
 const auth=await psnFromNpsso('A'.repeat(64),{fetchImpl});assert.equal(auth.access,'AT');
 const r=await psnTrophies('NPWR07890_00',auth,{language:'pt-BR',fetchImpl});
 assert.equal(r.service,'trophy');assert.deepEqual(r.achievements.map(a=>[a.title,a.grade,!!a.earnedAt]),[['Rei do Olimpo','P',false],['Abrindo as comportas','B',true],['Mão','S',false]]);
 assert.ok(seen.some(([u,l])=>u.includes('/npCommunicationIds/NPWR07890_00/')&&l==='pt-BR'));
 await assert.rejects(psnFromNpsso('curto',{fetchImpl}));
});

test('Playtime from Playnite (LiteDB) and others: matched by store id or title, highest value wins, never added twice', t => {
 const d=tmp(t);
 const bsonDoc=(name,secs)=>{const n=Buffer.from(name+'\0'),parts=[Buffer.from('\x02Name\x00','latin1'),Buffer.alloc(4),n,Buffer.from('\x12Playtime\x00','latin1'),Buffer.alloc(8)];parts[1].writeInt32LE(n.length);parts[4].writeBigInt64LE(BigInt(secs));return Buffer.concat(parts);};
 const page=Buffer.alloc(8192);Buffer.concat([bsonDoc('Hollow Knight',7200),Buffer.alloc(40),bsonDoc('Celeste',600)]).copy(page,100);
 const db=write(path.join(d,'games.db'),Buffer.concat([Buffer.alloc(8192),page]));
 const rows=playnitePlaytime({},[db]);assert.deepEqual(rows.map(r=>[r.title,r.seconds]),[['Hollow Knight',7200],['Celeste',600]]);
 const games=[{uuid:'11111111-1111-4111-8111-111111111111',title:'Hollow Knight™'},{uuid:'22222222-2222-4222-8222-222222222222',title:'GTA V',store:{name:'epic',appName:'Grouse'}}];
 const r=applyImported(games,[...rows,{source:'Epic',key:'epic:grouse',seconds:36000}],d);assert.equal(r.matched,2);
 const store=new SessionStore(d);
 assert.equal(store.forGame(games[0].uuid,'1').seconds,7200);assert.equal(store.forGame(games[1].uuid,'1').seconds,36000);
 applyImported(games,[{source:'Playnite',key:'title:hollowknight',seconds:100}],d);assert.equal(store.forGame(games[0].uuid,'1').seconds,7200,'valor menor não substitui');
});

test('Remove everything: the Taiga Launcher collection is deleted from Steam cloud storage', t => {
 const d=tmp(t),base=path.join(d,'userdata','1','config','cloudstorage');
 write(path.join(base,'cloud-storage-namespace-1.json'),JSON.stringify([['user-collections.taiga-steamtaiga',{key:'user-collections.taiga-steamtaiga',version:'5',value:JSON.stringify({id:'taiga-steamtaiga',name:'Taiga Launcher',added:[1],removed:[]})}],['user-collections.minha',{key:'user-collections.minha',version:'3',value:JSON.stringify({id:'minha',name:'Minha',added:[2],removed:[]})}]]));
 write(path.join(base,'cloud-storage-namespaces.json'),JSON.stringify([[1,'5']]));
 const w=collectionDelete(d,'1');assert.equal(w.length,2);const entries=JSON.parse(w[0][1].toString());
 assert.equal(entries[0][1].is_deleted,true);assert.equal(entries[0][1].version,'6');assert.ok(!entries[1][1].is_deleted,'outras coleções intactas');
 assert.deepEqual(JSON.parse(w[1][1].toString()),[[1,'6']]);
});

test('Data folder: old TaigaSteamPSP is renamed to "Taiga Launcher" on first start', async t => {
 const {defaultDataDir}=await import('../lib/launch-engine.mjs');
 const d=tmp(t),old={l:process.env.LOCALAPPDATA,t:process.env.TAIGA_DATA};t.after(()=>{if(old.l===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=old.l;if(old.t!==undefined)process.env.TAIGA_DATA=old.t;});
 delete process.env.TAIGA_DATA;process.env.LOCALAPPDATA=d;write(path.join(d,'TaigaSteamPSP','games.json'),'{"games":[]}');
 assert.equal(defaultDataDir(),path.join(d,'Taiga Launcher'));assert.ok(fs.existsSync(path.join(d,'Taiga Launcher','games.json')));assert.ok(!fs.existsSync(path.join(d,'TaigaSteamPSP')));
 assert.equal(defaultDataDir(),path.join(d,'Taiga Launcher'),'segunda vez: só usa a nova');
});

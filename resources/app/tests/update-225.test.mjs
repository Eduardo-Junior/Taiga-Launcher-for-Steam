// 2.2.5: AppID da Steam por consenso de fontes independentes.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {resolveSteamAppId,steamManifest} from '../lib/steam-resolve.mjs';
const run=(sources,verify=async id=>({ok:true,name:{2638370:"Five Nights at Freddy's: Into the Pit",271590:'Grand Theft Auto V Legacy',3240220:'Grand Theft Auto V Enhanced',99:'Outro jogo'}[id]||'X'}))=>resolveSteamAppId({title:"Five Nights at Freddy's: Into the Pit"},{sources,verify,local:false,useSaves:false});
test('Steam AppID: independent sources that agree link on their own; one name search alone does not', async () => {
 let r=await run({wikidata:async()=>[2638370],pcgamingwiki:async()=>[2638370],steam:async()=>[2638370]});assert.deepEqual([r.appId,r.confident],[2638370,true]);assert.deepEqual(r.via.sort(),['pcgamingwiki','steam','wikidata']);
 r=await run({wikidata:async()=>[2638370]});assert.equal(r.confident,true,'um banco com ID + nome igual na loja');
 r=await run({steam:async()=>[2638370]});assert.equal(r.confident,false,'só a busca pelo nome não basta');
 r=await run({wikidata:async()=>[2638370],pcgamingwiki:async()=>[99]});assert.equal(r.confident,false,'fontes discordam: pede confirmação');assert.equal(r.candidates.length,2);
 r=await run({wikidata:async()=>[2638370]},async()=>({ok:false}));assert.equal(r.appId,null,'DLC/trilha sonora/demo não vale');
 r=await run({wikidata:async()=>{throw Error('offline');},pcgamingwiki:async()=>[2638370],igdb:async()=>[2638370]});assert.equal(r.appId,2638370,'uma fonte fora do ar não atrapalha');
});
test('Steam AppID: game inside steamapps/common is identified by the library appmanifest', t => {
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-225b-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));
 const lib=path.join(d,'SteamLibrary','steamapps');fs.mkdirSync(path.join(lib,'common','Hollow Knight'),{recursive:true});fs.writeFileSync(path.join(lib,'appmanifest_367520.acf'),'"AppState"\n{\n\t"appid"\t\t"367520"\n\t"installdir"\t\t"Hollow Knight"\n}\n');
 assert.deepEqual(steamManifest(path.join(lib,'common','Hollow Knight')),{appId:367520,source:'appmanifest'});
});

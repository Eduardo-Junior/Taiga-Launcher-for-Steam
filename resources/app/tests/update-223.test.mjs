// Taiga Launcher 2.2.3: lista de troféus do Exophase guardada quando o site falha.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {exophaseTrophies} from '../lib/exophase.mjs';
test('Exophase: when the site fails later, the last good list is used instead of nothing', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-223-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const LI=(n,d)=>`<li class="award" data-average="50.0"><div class="award-title"><a href="#">${n}</a></div><div class="award-description"><p>${d}</p></div></li>`;
 const ok={request:async()=>({games:{list:[{title:'God of War III Remastered',total_awards:2,endpoint_awards:'https://www.exophase.com/game/gow3/trophies/',platforms:[{slug:'ps4'}]}]}}),page:async()=>`<ul class="trophy">${LI('King of the Hill','Unlock all trophies')}${LI('Releasing the Floodgates','Kill Poseidon')}</ul>`};
 const first=await exophaseTrophies({title:'God of War III Remastered',count:2},{...ok,cacheDir:dir});assert.equal(first[1].description,'Kill Poseidon');
 // Cache vencido e site fora do ar.
 for(const f of fs.readdirSync(dir).filter(f=>!f.includes('.good.')))fs.writeFileSync(path.join(dir,f),JSON.stringify({at:0,list:first}));
 const again=await exophaseTrophies({title:'God of War III Remastered',count:2},{request:async()=>{throw Error('403');},page:async()=>'',cacheDir:dir});
 assert.equal(again?.[1]?.description,'Kill Poseidon');
});

// 2.2.5: ligação ao AppID por prova (arquivos da pasta, ficha da Steam), não só pelo nome.
import {appIdFromFolder,engineProductName,folderExecutables,verifyCandidates,appIdFromText} from '../lib/steam-appid-proof.mjs';
const mk=(f,c)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c);};
test('AppID proof: steam_appid.txt next to steam_api64.dll deep inside a Unity game wins; Spacewar 480 and generic folders are ignored', t => {
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-225-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));
 const game=path.join(d,'FiveNightsatFreddysICCsjt');mk(path.join(game,'FNaFIntoThePit.exe'),'x');mk(path.join(game,'FNaFIntoThePit_Data','app.info'),"Steel Wool Studios\nFive Nights at Freddy's: Into the Pit");
 mk(path.join(game,'FNaFIntoThePit_Data','Plugins','x86_64','steam_api64.dll'),'x');mk(path.join(game,'FNaFIntoThePit_Data','Plugins','x86_64','steam_settings','steam_appid.txt'),'2638370\n');
 mk(path.join(game,'OnlineFix.ini'),'[Main]\nFakeAppId=480\n');
 assert.deepEqual(appIdFromFolder(game)?.appId,2638370);
 assert.equal(engineProductName(game).product,"Five Nights at Freddy's: Into the Pit");
 assert.ok(folderExecutables(game).includes('fnafintothepit.exe'));
 const other=path.join(d,'Outro');mk(path.join(other,'OnlineFix64.ini'),'RealAppId=1234\nFakeAppId=480\n');assert.equal(appIdFromFolder(other).appId,1234);
 const crack=path.join(d,'Crack');mk(path.join(crack,'steam_emu.ini'),'AppId=480\n');assert.equal(appIdFromFolder(crack),null);
 const downloads=path.join(d,'Downloads');mk(path.join(downloads,'steam_appid.txt'),'10');assert.equal(appIdFromFolder(downloads),null,'pasta genérica');
 assert.equal(appIdFromText('[TENOKE]\nid = 2050650\n','tenoke.ini'),2050650);assert.equal(appIdFromText('[config]\nappid = 413150\n','cream_api.ini'),413150);
});
test('AppID proof: name candidates are checked against the Steam app info (launch exe / install folder); only one match links', async () => {
 const pics={2638370:{common:{type:'Game',name:"Five Nights at Freddy's: Into the Pit"},config:{installdir:'FNaF Into The Pit',launch:{0:{executable:'FNaFIntoThePit.exe',config:{oslist:'windows'}}}}},2014380:{common:{type:'Game',name:'LIVE A LIVE'},config:{installdir:'LIVE A LIVE',launch:{0:{executable:'LIVEALIVE.exe'}}}},999:{common:{type:'Music',name:'OST'},config:{launch:{}}}};
 const request=async url=>{const id=url.split('/').pop();return {status:'success',data:{[id]:pics[id]}};};
 const v=await verifyCandidates([{appId:999},{appId:2638370},{appId:2014380}],{exes:['fnafintothepit.exe'],folder:'FiveNightsatFreddysICCsjt',request});
 assert.deepEqual([v.appId,v.by],[2638370,'exe']);
 assert.equal(await verifyCandidates([{appId:2014380}],{exes:['valorant.exe'],folder:'live',request}),null,'VALORANT não vira LIVE A LIVE');
});

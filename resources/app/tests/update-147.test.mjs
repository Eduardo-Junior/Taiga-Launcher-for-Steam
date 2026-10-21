// TaigaSteam 1.4.7, conta Epic achada sozinha, jogos repetidos barrados e idioma da página.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {epicAccountFromText,epicAccountIdFromLauncher} from '../lib/store-achievements.mjs';
import {duplicateOf} from '../lib/reconcile.mjs';
import {AchievementProviderManager} from '../lib/achievement-manager.mjs';
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-147-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
const write=(f,c)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c);return f;};
const A='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',B='0123456789abcdef0123456789abcdef',FRIEND='ffffffffffffffffffffffffffffffff';

test('Epic account: -epicuserid from the launcher log wins over other ids mentioned in the logs',t=>{
 assert.equal(epicAccountFromText('LaunchApp "Game.exe" -AUTH_TYPE=exchangecode -epicapp=x -epicuserid='+B+' -epiclocale=pt-BR'),B);
 const dir=tmp(t),env={LOCALAPPDATA:dir};
 write(path.join(dir,'EpicGamesLauncher','Saved','Logs','EpicGamesLauncher.log'),'[Friends] accountId: '+FRIEND+'\nLaunching -epicusername="Gabriel" -epicuserid='+A+' -epiclocale=pt-BR\n');
 assert.equal(epicAccountIdFromLauncher(env),A);
 // Sem registro de jogo aberto: usa o accountId guardado pela loja do launcher.
 const dir2=tmp(t);write(path.join(dir2,'EpicGamesLauncher','Saved','webcache_4430','Local Storage','leveldb','000003.log'),'\u0000_https://store.epicgames.com\u0000\u0001{"accountId":"'+B+'","displayName":"x"}');
 assert.equal(epicAccountIdFromLauncher({LOCALAPPDATA:dir2}),B);
});

test('Epic account captured from the running game is used for the progress',t=>{
 const config={language:'pt-BR',epicAccount:'',epicAccountDetected:B};
 const m=new AchievementProviderManager({config:()=>config,dir:tmp(t),providers:{},env:{}});
 assert.equal(m.epicAccount(),B);assert.equal(m.epicSource(),'game');
 config.epicAccount='https://store.epicgames.com/u/'+A;assert.equal(m.epicAccount(),A);assert.equal(m.epicSource(),'manual');
});

test('Duplicates: same disc code, identical copy, same store entry or same Steam game are not added twice',()=>{
 const psp={id:'p',title:'God of War: Chains of Olympus',path:'D:\\ISOs\\GoW.iso',profile:'psp',platformKey:'psp',serial:'UCUS98653',fingerprint:'f1',fingerprintKind:'full',bytes:10};
 const epic={id:'e',title:"Five Nights at Freddy's: Into the Pit",path:'C:\\Epic\\FNAF\\Game.exe',profile:'store',store:{name:'epic',id:'abc'},metadataSteamAppId:2638370};
 const games=[psp,epic];
 // Mesma ISO em outra pasta, com outro nome: o código do disco prova que é o mesmo jogo.
 assert.equal(duplicateOf(games,{path:'E:\\Backup\\copia.iso',profile:'psp',platformKey:'psp',platformSource:'header',serial:'UCUS-98653'})?.reason,'serial');
 // Outra região (outro código) continua permitida.
 assert.equal(duplicateOf(games,{path:'E:\\eu.iso',profile:'psp',platformKey:'psp',platformSource:'header',serial:'UCES-00842'}),null);
 // Código só pelo nome do arquivo não basta.
 assert.equal(duplicateOf(games,{path:'E:\\x.iso',profile:'psp',platformKey:'psp',platformSource:'extension',serial:'UCUS98653'}),null);
 assert.equal(duplicateOf(games,{path:'E:\\renomeada.iso',profile:'psp',fingerprint:'f1',fingerprintKind:'full',bytes:10})?.reason,'identical');
 assert.equal(duplicateOf(games,{path:'C:\\Other\\Game.exe',profile:'store',store:{name:'epic',id:'abc'}})?.reason,'store');
 assert.equal(duplicateOf(games,{path:'C:\\GOG\\FNAF\\Game.exe',profile:'pc',steamAppId:2638370},{steamAppIdOf:g=>g.metadataSteamAppId||null})?.reason,'steam');
 assert.equal(duplicateOf(games,{path:'c:\\epic\\fnaf\\GAME.EXE',profile:'pc'})?.reason,'path');
 assert.equal(duplicateOf(games,{path:'C:\\Games\\Outro.exe',profile:'pc'}),null);
});

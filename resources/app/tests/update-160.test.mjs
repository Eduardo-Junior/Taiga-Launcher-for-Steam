// TaigaSteam 1.6.0, pasta de atalhos, busca automática só de emuladores/lojas e capas sem chave de API.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {parseLnk,parseUrlFile,listShortcuts,epicFromUrl} from '../lib/shortcut-folder.mjs';
import {Providers} from '../lib/providers.mjs';
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-160-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};

// Monta um .lnk mínimo (MS-SHLLINK): cabeçalho + LinkInfo com LocalBasePath + strings Unicode.
function lnk(target,{args='',workingDir=''}={}){
 const header=Buffer.alloc(76);header.writeUInt32LE(0x4c,0);let flags=0x02|0x80;if(workingDir)flags|=0x10;if(args)flags|=0x20;header.writeUInt32LE(flags,0x14);
 const base=Buffer.from(target+'\0','latin1'),info=Buffer.alloc(28);const size=28+base.length+1;
 info.writeUInt32LE(size,0);info.writeUInt32LE(0x1c,4);info.writeUInt32LE(1,8);info.writeUInt32LE(0,12);info.writeUInt32LE(28,16);info.writeUInt32LE(0,20);info.writeUInt32LE(28+base.length,24);
 const str=s=>{const n=Buffer.alloc(2);n.writeUInt16LE(s.length);return Buffer.concat([n,Buffer.from(s,'utf16le')]);};
 return Buffer.concat([header,info,base,Buffer.from([0]),...(workingDir?[str(workingDir)]:[]),...(args?[str(args)]:[])]);
}

test('Shortcut files: .lnk target, arguments and folder are read without PowerShell',()=>{
 const l=parseLnk(lnk('C:\\Games\\Hollow Knight\\hollow_knight.exe',{args:'-popupwindow',workingDir:'C:\\Games\\Hollow Knight'}));
 assert.equal(l.target,'C:\\Games\\Hollow Knight\\hollow_knight.exe');assert.equal(l.arguments,'-popupwindow');assert.equal(l.workingDir,'C:\\Games\\Hollow Knight');
 assert.throws(()=>parseLnk(Buffer.from('not a shortcut')));
 assert.equal(parseUrlFile('[InternetShortcut]\r\nURL=com.epicgames.launcher://apps/abc%3Adef%3AFortnite?action=launch\r\n'),'com.epicgames.launcher://apps/abc%3Adef%3AFortnite?action=launch');
 assert.deepEqual(epicFromUrl('com.epicgames.launcher://apps/abc%3Adef%3AFortnite?action=launch&silent=true'),{namespace:'abc',catalogItemId:'def',appName:'Fortnite'});
 assert.deepEqual(epicFromUrl('com.epicgames.launcher://apps/Sugar?action=launch'),{appName:'Sugar'});
 assert.equal(epicFromUrl('https://store.epicgames.com'),null);
});

test('Shortcut folder lists games (one subfolder deep), skips Steam links and reports broken shortcuts',t=>{
 const dir=tmp(t);
 fs.writeFileSync(path.join(dir,'Hollow Knight.lnk'),lnk('C:\\Games\\HK\\hollow_knight.exe'));
 fs.writeFileSync(path.join(dir,'Manual.lnk'),lnk('C:\\Docs\\manual.pdf'));
 fs.writeFileSync(path.join(dir,'Steam game.url'),'[InternetShortcut]\nURL=steam://rungameid/570\n');
 fs.mkdirSync(path.join(dir,'Epic'));fs.writeFileSync(path.join(dir,'Epic','Fortnite.url'),'[InternetShortcut]\nURL=com.epicgames.launcher://apps/a%3Ab%3AFortnite?action=launch\n');
 fs.mkdirSync(path.join(dir,'Epic','Deep'));fs.writeFileSync(path.join(dir,'Epic','Deep','Too deep.exe'),'MZ');
 fs.writeFileSync(path.join(dir,'leia.txt'),'x');
 const {items,errors}=listShortcuts(dir);
 assert.deepEqual(items.map(i=>i.name).sort(),['Fortnite','Hollow Knight']);
 assert.equal(items.find(i=>i.name==='Hollow Knight').workingDir.replace(/\//g,'\\').endsWith('HK'),true);
 assert.equal(errors.length,1);assert.match(errors[0].file,/Manual\.lnk$/);
});

test('Shortcut folder sync: a game per shortcut, named after it; deleting the shortcut hides the game',async t=>{
 const root=tmp(t),dataDir=path.join(root,'data'),folder=path.join(root,'Atalhos'),gameDir=path.join(root,'Games','Celeste');fs.mkdirSync(gameDir,{recursive:true});
 const exe=path.join(gameDir,'Celeste.exe');fs.writeFileSync(exe,'MZ');
 const factory=(c,d)=>{const p=new Providers(c,d);p.candidates=async()=>({igdb:[],sgdb:[],ra:[],free:[],errors:[]});p.completeMissing=async()=>[];p.cachedAchievements=()=>null;return p;};
 const {createApp}=await import('../server.mjs');const {server}=createApp({dataDir,port:48960,providersFactory:factory});await new Promise(r=>server.listen(48960,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const token=JSON.parse(fs.readFileSync(path.join(dataDir,'config.json'))).adminToken;
 const api=async(route,body)=>{const r=await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,200,text);return JSON.parse(text);};
 fs.mkdirSync(folder);fs.copyFileSync(exe,path.join(folder,'Celeste (Speedrun).exe'));
 let r=await api('shortcut-folder',{action:'set',path:folder});assert.equal(r.folder,folder);assert.equal(r.added,1);
 let state=await api('state');const g=state.games.find(x=>x.title==='Celeste (Speedrun)');assert.ok(g,'o nome do atalho vira o nome do jogo');assert.equal(g.profile,'pc');
 r=await api('shortcut-folder',{action:'sync'});assert.equal(r.added,0,'sincronizar de novo não repete o jogo');
 fs.unlinkSync(path.join(folder,'Celeste (Speedrun).exe'));r=await api('shortcut-folder',{action:'sync'});assert.equal(r.removed,1);
 state=await api('state');assert.ok(!state.games.some(x=>x.title==='Celeste (Speedrun)'&&!x.hidden));
 r=await api('shortcut-folder',{action:'disable'});assert.equal(r.folder,'');
});

test('Covers without any API key: free libretro candidates and no "key missing" errors',async t=>{
 const dir=tmp(t),config={sgdbKey:'',igdbId:'',igdbSecret:'',profileServer:''};
 const p=new Providers(()=>config,dir);
 assert.equal(p.sgAvailable(),false);assert.equal(p.igAvailable(),false);
 config.profileServer='https://perfis.example.workers.dev';assert.equal(p.sgAvailable(),true,'o servidor do TaigaSteam serve de ponte para o SteamGridDB');
});

test('Every fixed server error and message has a translation; dynamic messages are translated by template',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const L=require('../locales/runtime.cjs'),catalog=require('../locales/catalog.cjs');
 const known=new Set(Object.values(catalog).map(r=>r['pt-BR']));
 const files=['../server.mjs',...fs.readdirSync(new URL('../lib',import.meta.url)).filter(f=>f.endsWith('.mjs')).map(f=>'../lib/'+f)];
 const missing=[];
 for(const f of files){const src=fs.readFileSync(new URL(f,import.meta.url),'utf8');
  for(const m of src.matchAll(/(?:Error\(|message:)\s*'((?:[^'\\]|\\.)+)'\s*[),}]/g)){const t=m[1].replace(/\\'/g,"'");if(/[ãçéêíóõúàâ]|\b(não|jogo|arquivo|pasta|conta)\b/i.test(t)&&!known.has(t))missing.push(f+': '+t);}}
 assert.deepEqual(missing,[],'Mensagens sem tradução em locales/server-messages.json');
 const en=L.create('en'),de=L.create('de');
 assert.equal(en.text('Este arquivo é uma cópia idêntica de "Ico", que já está na coleção.'),'This file is an identical copy of "Ico", which is already in the collection.');
 assert.equal(de.text('2 jogo(s) aplicado(s) na Steam sem reiniciar.'),'2 Spiel(e) ohne Neustart in Steam übernommen.');
 assert.equal(en.text('Adicionar à Steam automaticamente: Reinicie a Steam para ver os jogos novos.'),'Add to Steam automatically: Restart Steam to see the new games.');
 assert.equal(en.text('Um nome de jogo qualquer'),'Um nome de jogo qualquer');
 assert.equal(L.create('pt-BR').text('Jogo não encontrado.'),'Jogo não encontrado.');
});

test('Emulators: any renamed .exe is recognized, more emulators are known, BizHawk reuses its RetroAchievements login',async t=>{
 const {guessProfile,emulatorDisplayName,PROFILES}=await import('../lib/emulator-registry.mjs');const {PLATFORMS}=await import('../lib/platforms.mjs');const {emulatorAccounts}=await import('../lib/emulator-accounts.mjs');
 assert.equal(guessProfile('C:\\Emus\\BizHawk\\EmuHawk.exe'),'bizhawk');assert.equal(guessProfile('D:\\PCSX2 Nightly\\pcsx2-qt-avx2-custom.exe'),'ps2');assert.equal(guessProfile('C:\\Games\\Celeste.exe'),null);
 assert.equal(emulatorDisplayName('melonds','C:\\DeSmuME\\DeSmuME.exe'),'DeSmuME');assert.equal(emulatorDisplayName('ps1','C:\\x\\duckstation-qt.exe'),'DuckStation');
 for(const key of ['bizhawk','ares','mednafen','stella','fusion'])assert.ok(PROFILES[key]?.files?.length,key);
 assert.ok(PLATFORMS.find(p=>p.key==='atari2600').profiles.includes('stella'));assert.equal(PLATFORMS.find(p=>p.key==='nes').profiles.at(-1),'retroarch');
 const dir=tmp(t);fs.writeFileSync(path.join(dir,'EmuHawk.exe'),'');fs.writeFileSync(path.join(dir,'config.ini'),JSON.stringify({RAUsername:'gabriel',RAToken:'abcdefABCDEF123456'}));
 assert.equal(emulatorAccounts({launchers:{bizhawk:{exe:path.join(dir,'EmuHawk.exe')}}},{})[0]?.user,'gabriel');
});

test('Remove = out of Steam and TaigaSteam, never deletes files, does not come back from the shortcuts folder until restored; account notice for GOG',async t=>{
 const root=tmp(t),dataDir=path.join(root,'data'),folder=path.join(root,'Atalhos');fs.mkdirSync(path.join(folder,'The Witcher 3'),{recursive:true});
 fs.writeFileSync(path.join(folder,'Hades.exe'),'MZ');fs.writeFileSync(path.join(folder,'Celeste.exe'),'MZ');
 fs.writeFileSync(path.join(folder,'The Witcher 3','witcher3.exe'),'MZ');fs.writeFileSync(path.join(folder,'The Witcher 3','unins000.exe'),'MZ');fs.writeFileSync(path.join(folder,'The Witcher 3','goggame-1207664663.info'),'{}');
 const factory=(c,d)=>{const p=new Providers(c,d);p.completeMissing=async()=>[];p.cachedAchievements=()=>null;return p;};
 const {createApp}=await import('../server.mjs');const {server}=createApp({dataDir,port:48961,providersFactory:factory});await new Promise(r=>server.listen(48961,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const token=JSON.parse(fs.readFileSync(path.join(dataDir,'config.json'))).adminToken;
 const api=async(route,body)=>{const r=await fetch(`http://127.0.0.1:48961/api/${route}`,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,200,text);return JSON.parse(text);};
 const r=await api('shortcut-folder',{action:'set',path:folder});assert.equal(r.added,3,'.exe iguais (Hades/Celeste) são jogos diferentes; desinstalador fica de fora');
 let state=await api('state');const titles=state.games.map(g=>g.title).sort();assert.deepEqual(titles,['Celeste','Hades','The Witcher 3']);
 const witcher=state.games.find(g=>g.title==='The Witcher 3');assert.equal(witcher.accountNeed,'gog');assert.equal(witcher.fromShortcut,true);
 await api('settings',{gogUser:'gabriel'});state=await api('state');assert.equal(state.games.find(g=>g.title==='The Witcher 3').accountNeed,null);
 const hades=state.games.find(g=>g.title==='Hades');const removed=await api('remove-games',{ids:[hades.id]});assert.match(removed.message,/arquivos e saves/);
 assert.ok(fs.existsSync(path.join(folder,'Hades.exe')),'o arquivo nunca é apagado');
 await api('shortcut-folder',{action:'sync'});state=await api('state');assert.ok(!state.games.some(g=>g.title==='Hades'),'removido não volta sozinho');
 await api('collection-restore',{id:hades.id});await api('shortcut-folder',{action:'sync'});state=await api('state');assert.equal(state.games.filter(g=>g.title==='Hades').length,1,'recuperado volta uma vez só');
});

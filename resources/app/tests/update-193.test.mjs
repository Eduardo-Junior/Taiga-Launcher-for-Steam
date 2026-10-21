// Taiga Launcher 1.9.4, nomes dos troféus de ports pelo Exophase, port achado sozinho, pacote para outro PC.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {parseExophaseTrophies,exophaseTrophies} from '../lib/exophase.mjs';
import {readPortTrophies,PortTrophyStore} from '../lib/port-trophies.mjs';
import {findInstalledGames} from '../lib/installed-games.mjs';
import {buildPortablePackage} from '../lib/portable-package.mjs';
import {readBuiltinKeys} from '../lib/builtin-keys.mjs';
const tmp=t=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-193-'));t.after(()=>fs.rmSync(d,{recursive:true,force:true}));return d;};
const write=(f,c)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c);return f;};
const sfoOf=(title,code)=>{const keys=['TITLE','TITLE_ID'],vals=[title,code];const kt=Buffer.from(keys.join('\0')+'\0'),dt=Buffer.concat(vals.map(v=>{const b=Buffer.alloc(64);b.write(v);return b;}));const h=Buffer.alloc(20+keys.length*16);h.writeUInt32LE(0x46535000,0);h.writeUInt32LE(0x101,4);h.writeUInt32LE(20+keys.length*16,8);h.writeUInt32LE(20+keys.length*16+kt.length,12);h.writeUInt32LE(keys.length,16);let ko=0;keys.forEach((k,i)=>{const p=20+i*16;h.writeUInt16LE(ko,p);h.writeUInt16LE(0x204,p+2);h.writeUInt32LE(vals[i].length+1,p+4);h.writeUInt32LE(64,p+8);h.writeUInt32LE(i*64,p+12);ko+=k.length+1;});return Buffer.concat([h,kt,dt]);};
const PNG=n=>Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('icon'+n)]);
const trp=files=>{const head=Buffer.alloc(0x60),entries=Buffer.alloc(files.length*0x40);head.writeUInt32BE(0xDCA24D00,0);head.writeUInt32BE(files.length,0x10);head.writeUInt32BE(0x40,0x14);let pos=0x60+entries.length;const bodies=[];files.forEach(([name,d],i)=>{entries.write(name,i*0x40,'latin1');entries.writeBigUInt64BE(BigInt(pos),i*0x40+32);entries.writeBigUInt64BE(BigInt(d.length),i*0x40+40);bodies.push(d);pos+=d.length;});return Buffer.concat([head,entries,...bodies]);};
const LI=(name,desc,cls='',avg='50.0')=>`<li class="award ${cls}" data-average="${avg}"><div class="award-image"><img src="https://m.exophase.com/psn/awards/s/x.png?a" alt=""></div><div class="award-details"><div class="award-title"><a href="https://www.exophase.com/trophy/x/1-a">${name}</a></div><div class="award-description"><p>${desc}</p></div></div></li>`;
const HTML=`<html><body><h2 class="me-2"><a title="God of War III Remastered">x</a></h2><ul class="list-unstyled trophy">${LI('King of the Hill','Unlock all trophies','platinum','17.58')}${LI('Releasing the Floodgates','Kill Poseidon','bronze','96.17')}${LI('Mr. Hand','Discover the secret &#039;Hades Arm&#039; room','secret silver')}</ul></body></html>`;

test('Exophase: trophy list parsed; port trophies get names, descriptions, grades and rarity in the dump order', async t => {
 const list=parseExophaseTrophies(HTML);
 assert.deepEqual(list.map(a=>[a.title,a.grade,a.hidden]),[['King of the Hill','P',false],['Releasing the Floodgates','B',false],['Mr. Hand','S',true]]);
 assert.equal(list[2].description,"Discover the secret 'Hades Arm' room");assert.equal(list[1].globalPercent,96.17);
 const d=tmp(t),calls=[];
 const request=async u=>{calls.push(u);return {success:true,games:{list:[{title:'God of War III',total_awards:48,platforms:[{slug:'ps3'}],endpoint_awards:'https://www.exophase.com/game/god-of-war-iii-ps3/trophies/'},{title:'God of War III Remastered',total_awards:3,platforms:[{slug:'ps4'}],endpoint_awards:'https://www.exophase.com/game/god-of-war-iii-remastered-ps4/trophies/'}]}};};
 const pages=[];const page=async u=>{pages.push(u);return HTML;};
 const names=await exophaseTrophies({title:'God of War III Remastered',platform:'PlayStation 4',count:3},{request,page,cacheDir:d});
 assert.equal(names.length,3);assert.deepEqual(pages,['https://www.exophase.com/game/god-of-war-iii-remastered-ps4/trophies/']);
 // Cache: não consulta de novo.
 await exophaseTrophies({title:'God of War III Remastered',platform:'PlayStation 4',count:3},{request,page,cacheDir:d});assert.equal(pages.length,1);
 // Quantidade diferente da do dump: não usa (a ordem não seria confiável).
 assert.equal(await exophaseTrophies({title:'God of War III Remastered',platform:'PlayStation 4',count:35},{request,page,cacheDir:d}),null);
 // Port com lista cifrada (só ícones) + nomes do Exophase.
 const dump=path.join(d,'dump');write(path.join(dump,'Sc0','param.sfo'),sfoOf('God of War III Remastered','CUSA01623'));write(path.join(dump,'Sc0','trophy','trophy00.trp'),trp([['TROP.ESFM',Buffer.alloc(64)],['TROP000.PNG',PNG(0)],['TROP001.PNG',PNG(1)],['TROP002.PNG',PNG(2)]]));
 const store=new PortTrophyStore(d),game={uuid:'55555555-5555-4555-8555-555555555555',title:'GOW3',path:path.join(d,'x.exe'),profile:'pc'};store.record(game.uuid,1);store.record(game.uuid,2);
 const port={title:'God of War III Remastered',platform:'PlayStation 4',dump};
 const plain=readPortTrophies(game,port,{config:{},dataDir:d,store,env:{}});assert.equal(plain.detail,'icons');
 const r=readPortTrophies(game,port,{config:{},dataDir:d,store,env:{},names});
 assert.equal(r.detail,'online');assert.equal(r.sourceLanguage,'en');assert.match(r.source,/Exophase/);
 assert.deepEqual(r.achievements.map(a=>[a.title,a.grade,a.unlocked]),[['King of the Hill','P',true],['Releasing the Floodgates','B',true],['Mr. Hand','S',true]],'platina sai quando os outros estão completos');
});

test('Installed-games search finds console ports anywhere on the disk, with the official name from the dump', async t => {
 const d=tmp(t),drive=path.join(d,'D');
 write(path.join(drive,'Ports','SpartanPort','SpartanPort.exe'),Buffer.alloc(2048,1));
 write(path.join(drive,'Ports','SpartanPort','settings.json'),JSON.stringify({game_dir:path.join(drive,'Dumps','GOW3')}));
 write(path.join(drive,'Dumps','GOW3','sce_sys','param.sfo'),sfoOf('God of War III Remastered','CUSA01623'));
 write(path.join(drive,'Windows','x.exe'),'MZ');
 const found=await findInstalledGames({drives:[drive]});
 const port=found.find(f=>f.source==='port');assert.ok(port,'port encontrado');assert.equal(port.title,'God of War III Remastered');assert.equal(port.confidence,'high');assert.match(port.path,/SpartanPort\.exe$/);
});

test('Package for another PC: whole program, renamed exe, API keys of this PC, no personal or dev files', async t => {
 const d=tmp(t),inst=path.join(d,'install');
 write(path.join(inst,'TaigaPSP.exe'),'MZexe');write(path.join(inst,'ffmpeg.dll'),'dll');write(path.join(inst,'resources','app','server.mjs'),'//');write(path.join(inst,'resources','app','web','app.js'),'x'.repeat(5000));
 write(path.join(inst,'resources','app','chaves.json'),'{"sgdbKey":"OLD"}');write(path.join(inst,'resources','app','tests','a.test.mjs'),'t');write(path.join(inst,'third_party','x.txt'),'x');write(path.join(inst,'.git','HEAD'),'x');write(path.join(inst,'resources','app','REVISAO-1.0.md'),'x');write(path.join(inst,'LEIA-ME.txt'),'x');write(path.join(inst,'README.md'),'x');write(path.join(inst,'resources','app','LEIA-ME.md'),'x');write(path.join(inst,'resources','app','THIRD-PARTY-NOTICES.md'),'licencas');
 const out=path.join(d,'out','pkg.zip');
 const r=await buildPortablePackage({installDir:inst,out,keys:{sgdbKey:'S'.repeat(32),igdbId:'id123',igdbSecret:''},version:'9.9'});
 assert.deepEqual(r.keys,['sgdbKey','igdbId']);
 let names;try{names=execFileSync('unzip',['-Z1',out]).toString().trim().split('\n').sort();}catch{t.skip('unzip ausente');return;}
 assert.deepEqual(names,['Taiga Launcher/LEIA-ME.txt','Taiga Launcher/Taiga Launcher.exe','Taiga Launcher/ffmpeg.dll','Taiga Launcher/resources/app/THIRD-PARTY-NOTICES.md','Taiga Launcher/resources/app/chaves.json','Taiga Launcher/resources/app/server.mjs','Taiga Launcher/resources/app/web/app.js']);
 execFileSync('unzip',['-tq',out]);
 const keys=JSON.parse(execFileSync('unzip',['-p',out,'Taiga Launcher/resources/app/chaves.json']).toString());assert.equal(keys.sgdbKey,'S'.repeat(32));assert.equal(keys.igdbSecret,undefined);
 assert.equal(execFileSync('unzip',['-p',out,'Taiga Launcher/resources/app/web/app.js']).toString().length,5000);
 // Chaves também ao lado do .exe ou na pasta de dados.
 const exeDir=path.join(d,'exe'),dataDir=path.join(d,'data');write(path.join(dataDir,'chaves.json'),JSON.stringify({sgdbKey:'K'.repeat(32)}));
 assert.equal(readBuiltinKeys([path.join(d,'none'),exeDir,dataDir],{}).sgdbKey,'K'.repeat(32));
});

test('Achievement texts are translated in batches (few requests) and cached per text', async t => {
 const {translateMany}=await import('../lib/translation.mjs');
 const d=tmp(t),old={o:process.env.TAIGA_OFFLINE,g:process.env.TAIGA_TRANSLATE_GOOGLE,f:globalThis.fetch};t.after(()=>{process.env.TAIGA_OFFLINE=old.o??'';if(old.o===undefined)delete process.env.TAIGA_OFFLINE;if(old.g===undefined)delete process.env.TAIGA_TRANSLATE_GOOGLE;else process.env.TAIGA_TRANSLATE_GOOGLE=old.g;globalThis.fetch=old.f;});
 delete process.env.TAIGA_OFFLINE;process.env.TAIGA_TRANSLATE_GOOGLE='1';process.env.TAIGA_TRANSLATE_MS='0';t.after(()=>{delete process.env.TAIGA_TRANSLATE_MS;});let calls=0;
 globalThis.fetch=async url=>{calls++;const q=new URL(url).searchParams.get('q');return {ok:true,json:async()=>[q.split('\n').map((l,i,a)=>['PT '+l+(i<a.length-1?'\n':''),l])]};};
 const texts=['King of the Hill','Unlock all trophies','','Kill Poseidon'];
 const r=await translateMany(texts,d,async()=>{throw Error('no');},'pt-BR','en');
 assert.deepEqual([...r],['PT King of the Hill','PT Unlock all trophies','','PT Kill Poseidon']);assert.equal(calls,1);
 const again=await translateMany(texts,d,async()=>{throw Error('no');},'pt-BR','en');assert.equal(calls,1,'cache');assert.equal(again[3],'PT Kill Poseidon');
});

// 2.3.5: idioma inicial pelo Windows, ícone certo dos jogos encontrados (Xbox e .exe sem ícone), abrir com o Windows.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createApp,pickSystemLanguage} from '../server.mjs';import {iconSourceFor,peHasIcon} from '../lib/exe-icon-source.mjs';

test('First screen language follows Windows: pt any region, es, fr, de, en; anything else is English', () => {
 assert.equal(pickSystemLanguage(['pt-PT']),'pt-BR');assert.equal(pickSystemLanguage(['pt-BR','en-US']),'pt-BR');
 assert.equal(pickSystemLanguage(['es-MX']),'es');assert.equal(pickSystemLanguage(['fr-CA']),'fr');assert.equal(pickSystemLanguage(['de-AT']),'de');
 assert.equal(pickSystemLanguage(['en-GB']),'en');assert.equal(pickSystemLanguage(['ja-JP','pt-BR']),'en','primeiro idioma do Windows sem suporte: inglês');
 assert.equal(pickSystemLanguage(['it_IT']),'en');assert.equal(pickSystemLanguage([]),'pt-BR');assert.equal(pickSystemLanguage(null),'pt-BR');
});

test('Found games icon: Xbox package logo (largest scale), exe without icon falls back to another exe in the folder', t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-icon-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const content=path.join(dir,'Among Us','Content');fs.mkdirSync(path.join(content,'Assets'),{recursive:true});
 fs.writeFileSync(path.join(content,'MicrosoftGame.config'),'<Game><ShellVisuals Square150x150Logo="Assets\\Logo150.png" StoreLogo="Assets\\Store.png"/></Game>');
 fs.writeFileSync(path.join(content,'Assets','Logo150.scale-100.png'),'a');fs.writeFileSync(path.join(content,'Assets','Logo150.scale-200.png'),'b');
 fs.writeFileSync(path.join(content,'gamelaunchhelper.exe'),'MZ');
 assert.equal(iconSourceFor(path.join(content,'gamelaunchhelper.exe'),content).png,path.join(content,'Assets','Logo150.scale-200.png'));
 const real=path.resolve('../../Taiga Launcher.exe');if(!fs.existsSync(real))return;
 assert.equal(peHasIcon(real),true);
 const port=path.join(dir,'port');fs.mkdirSync(port);fs.writeFileSync(path.join(port,'game.exe'),Buffer.from('MZ'+'\0'.repeat(200)));fs.copyFileSync(real,path.join(port,'launcher.exe'));
 assert.equal(peHasIcon(path.join(port,'game.exe')),false);
 assert.equal(iconSourceFor(path.join(port,'game.exe'),port).exe,path.join(port,'launcher.exe'));
});

test('Start with Windows is on by default, can be turned off and the language before the choice follows Windows', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-boot-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const port=48921,seen=[];const app=createApp({dataDir:dir,port,systemLanguages:['fr-FR'],onStartupChange:on=>seen.push(on)});
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));t.after(()=>new Promise(r=>app.server.close(r)));
 const c=JSON.parse(fs.readFileSync(path.join(dir,'config.json')));
 const call=async(route,body)=>{const r=await fetch(`http://127.0.0.1:${port}/api/${route}`,{method:body===undefined?'GET':'POST',headers:{Connection:'close',Authorization:'Bearer '+c.adminToken,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return r.json();};
 let s=(await call('state')).settings;assert.equal(s.language,'fr');assert.equal(s.languageChosen,false);assert.equal(s.preferences.startWithWindows,true);assert.equal(app.startWithWindows(),true);
 await call('settings',{preferences:{startWithWindows:false}});assert.deepEqual(seen,[false]);assert.equal(app.startWithWindows(),false);
 await call('settings',{language:'de'});s=(await call('state')).settings;assert.equal(s.language,'de');assert.equal(s.languageChosen,true);
});

// 2.3.8: port para PC tem prioridade sobre a versão do emulador do mesmo jogo.
test('A PC port found next to a console dump in the collection replaces the emulator copy, keeping its art and data', async t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-port-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const sfo=(title,id)=>{const entries=[['TITLE',title],['TITLE_ID',id],['CATEGORY','gd']];const keys=Buffer.from(entries.map(x=>x[0]+'\0').join(''));const vals=Buffer.from(entries.map(x=>x[1]+'\0').join(''));const b=Buffer.alloc(20+16*entries.length+keys.length+vals.length);b.writeUInt32LE(0x46535000);b.writeUInt32LE(0x101,4);b.writeUInt32LE(20+16*entries.length,8);b.writeUInt32LE(20+16*entries.length+keys.length,12);b.writeUInt32LE(entries.length,16);let k=0,v=0;entries.forEach(([a,c],i)=>{const p=20+i*16;b.writeUInt16LE(k,p);b.writeUInt16LE(0x204,p+2);b.writeUInt32LE(c.length+1,p+4);b.writeUInt32LE(c.length+1,p+8);b.writeUInt32LE(v,p+12);k+=a.length+1;v+=c.length+1;});keys.copy(b,20+16*entries.length);vals.copy(b,20+16*entries.length+keys.length);return b;};
 const base=path.join(dir,'God of war 3'),dump=path.join(base,'CUSA01623'),portDir=path.join(base,'gow3-windows');
 fs.mkdirSync(path.join(dump,'sce_sys'),{recursive:true});fs.mkdirSync(portDir,{recursive:true});
 fs.writeFileSync(path.join(dump,'sce_sys','param.sfo'),sfo('God of War III Remastered','CUSA01623'));fs.writeFileSync(path.join(dump,'eboot.bin'),'x');
 const exe=path.join(portDir,'GoW3.exe');fs.writeFileSync(exe,Buffer.from('MZ'+'\0'.repeat(300)));
 const data=path.join(dir,'data');fs.mkdirSync(data);
 fs.writeFileSync(path.join(data,'games.json'),JSON.stringify({version:1,games:[{id:'ps4gow3',uuid:'11111111-1111-4111-8111-111111111111',title:'God of War III Remastered',path:path.join(dump,'eboot.bin'),profile:'shadps4',platformName:'PlayStation 4',bindings:{},art:{cover:'cover.png'},metadata:{summary:'Kratos'}}]}));
 const app=createApp({dataDir:data,port:48923});
 const adopted=await app.findPorts();
 assert.equal(adopted.length,1,'port adotado');
 const games=JSON.parse(fs.readFileSync(path.join(data,'games.json'),'utf8')).games;
 const port=games.find(g=>g.path===exe),old=games.find(g=>g.id==='ps4gow3');
 assert.equal(port.profile,'pc');assert.equal(port.title,'God of War III Remastered');assert.equal(port.art.cover,'cover.png');assert.equal(port.metadata.summary,'Kratos');
 assert.equal(old.hidden,true);assert.equal(old.hiddenReason,'port');assert.equal(old.mergedInto,port.id);
 assert.equal((await app.findPorts()).length,0,'não repete');
});

// TaigaSteam 1.4.5, o NativeGameLink só carrega quando a interface da Steam (React, webpack, janelas) está pronta,
// e uma injeção que falhou é tentada de novo em vez de ficar marcada como feita.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import vm from 'node:vm';
import {createApp} from '../server.mjs';
import {SteamInjector} from '../lib/steam-inject.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

test('shared script waits for the Steam React before loading the NativeGameLink bundle',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-145-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({language:'pt-BR',languageChosen:true,roots:[]}));
 const app=createApp({dataDir:dir,port:0});t.after(()=>app.server.close());
 const {shared}=await app.injector.scripts();
 assert.match(shared,/__TAIGA_NGL_LOADER__/);
 const timers=[];const win={setTimeout:(f,ms)=>{timers.push(f);return timers.length;},clearTimeout(){},addEventListener(){},removeEventListener(){},console,JSON,Date,Promise,Symbol,Object,Array,String,Number,Map,Set,WeakMap,WeakSet,Proxy,Reflect,Error,TypeError,RegExp,Math};
 win.window=win;win.document={title:'SharedJSContext',readyState:'complete',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
 const ctx=vm.createContext(win);
 // Steam recém-aberta: contexto existe, React ainda não. Antes o pacote quebrava aqui ("reading 'Component'").
 assert.doesNotThrow(()=>vm.runInContext(shared,ctx));
 assert.equal(ctx.__TAIGA_NGL_STATE__,'waiting');
 assert.equal(ctx.__TAIGA_NGL_MODULE__,undefined);
 // Rodar de novo (reinjeção) não cria um segundo carregador.
 const before=timers.length;vm.runInContext(shared,ctx);assert.equal(timers.length,before);
 // A interface da Steam termina de carregar: o pacote entra.
 win.SP_REACT={Component:class{},PureComponent:class{},createElement(){return null;},createContext:()=>({Provider:{},Consumer:{}}),Fragment:'f',useState:()=>[null,()=>{}],useEffect(){},useLayoutEffect(){},useRef:()=>({}),useMemo:f=>f(),useCallback:f=>f,forwardRef:f=>f,memo:f=>f};
 win.SP_REACTDOM={createPortal(){},render(){}};win.webpackChunksteamui=[];win.g_PopupManager={GetPopups:()=>[],AddPopupCreatedCallback(){}};win.SteamClient={Apps:{}};win.appStore={};
 for(let i=0;i<5&&!ctx.__TAIGA_NGL_MODULE__;i++){const f=timers.shift();if(f)f();}
 assert.ok(ctx.__TAIGA_NGL_MODULE__,'pacote carregado depois do React');
 assert.equal(typeof ctx.__TAIGA_NGL_MODULE__.default,'function');
});

test('a failed injection is not marked as done and is retried',async()=>{
 const sent=[];let fail=true;
 const inj=new SteamInjector({scripts:async()=>({shared:'boom()'}),kindOf:()=>'shared'});
 inj.ws={readyState:1,send(){} ,close(){}};
 inj.sessions.set('T1','S1');inj.kinds.set('T1','shared');
 inj.send=async(method,params)=>{sent.push(params.expression);const e=String(params.expression||'');if(e.startsWith('window.__TAIGA_INJECTED__==='))return {result:{value:false}};if(e==='document.readyState')return {result:{value:'complete'}};if(fail)return {exceptionDetails:{text:'Uncaught',exception:{description:"TypeError: Cannot read properties of undefined (reading 'Component')"}}};return {result:{value:true}};};
 assert.equal(await inj.ensure('T1'),false);
 assert.equal(inj.injected.has('T1'),false);
 assert.match(inj.lastError,/Component/);
 const expr=sent.find(e=>e.includes('boom()'));
 assert.ok(expr.indexOf('boom()')<expr.indexOf('__TAIGA_INJECTED__'),'a marca vem depois do script');
 // O ciclo do injetor confere de novo as janelas sem script.
 fail=false;await inj.tick();await sleep(30);
 assert.equal(inj.injected.get('T1'),'shared');
 inj.stop();
});

test('React missing as a global is taken from the Steam webpack modules (newer Steam builds)',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-145b-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({language:'pt-BR',languageChosen:true,roots:[]}));
 const app=createApp({dataDir:dir,port:0});t.after(()=>app.server.close());
 const {shared}=await app.injector.scripts();
 const timers=[];const win={setTimeout:(f)=>{timers.push(f);return timers.length;},clearTimeout(){},addEventListener(){},removeEventListener(){},console,JSON,Date,Promise,Symbol,Object,Array,String,Number,Map,Set,WeakMap,WeakSet,Proxy,Reflect,Error,TypeError,RegExp,Math};
 win.window=win;win.document={title:'SharedJSContext',readyState:'complete',addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
 const React={Component:class{},PureComponent:class{},createElement(){return null;},createContext:()=>({Provider:{},Consumer:{}}),Fragment:'f',useState:()=>[null,()=>{}],useEffect(){},useLayoutEffect(){},useRef:()=>({}),useMemo:f=>f(),useCallback:f=>f,forwardRef:f=>f,memo:f=>f};
 const ReactDOM={createPortal(){},flushSync(){}},client={createRoot(){},hydrateRoot(){}};
 const mods={1:m=>{m.exports=React;},2:m=>{m.exports=ReactDOM;},3:m=>{m.exports=client;}};
 win.webpackChunksteamui=[];win.webpackChunksteamui.push=chunk=>{const req=id=>{const m={exports:{}};mods[id](m);return m.exports;};req.m=mods;chunk[2](req);};
 win.g_PopupManager={GetPopups:()=>[],AddPopupCreatedCallback(){}};win.SteamClient={Apps:{}};win.appStore={};
 const ctx=vm.createContext(win);vm.runInContext(shared,ctx);
 for(let i=0;i<5&&!ctx.__TAIGA_NGL_MODULE__;i++){const f=timers.shift();if(f)f();}
 assert.equal(ctx.SP_REACT,React);
 assert.equal(typeof ctx.SP_REACTDOM.createRoot,'function');
 assert.deepEqual([...ctx.__TAIGA_NGL_MISSING__],[]);
 assert.ok(ctx.__TAIGA_NGL_MODULE__);
});

// 2.3.0: tradução com o tradutor da Microsoft (Edge) em lote, antes do Google e do MyMemory.
import test from 'node:test';import assert from 'node:assert/strict';
import {microsoftTranslate} from '../lib/translation.mjs';
test('Microsoft translator: token, batch of texts in order, empty texts kept, token renewed on 401', async () => {
 const calls=[];let first=true;
 const fetchImpl=async(url,opt={})=>{calls.push(url);if(url.includes('/translate/auth'))return {ok:true,status:200,text:async()=>'aaa.bbb.ccc'};
  if(first){first=false;return {ok:false,status:401,json:async()=>({})};}
  const body=JSON.parse(opt.body);assert.equal(opt.headers.Authorization,'Bearer aaa.bbb.ccc');assert.match(url,/to=pt/);assert.match(url,/from=en/);
  return {ok:true,status:200,json:async()=>body.map(b=>({translations:[{text:'PT:'+b.Text}]}))};};
 const r=await microsoftTranslate(['Kill Poseidon','','Unlock all trophies'],'pt-BR','en',fetchImpl);
 assert.deepEqual(r,['PT:Kill Poseidon','','PT:Unlock all trophies']);
 assert.equal(calls.filter(u=>u.includes('/auth')).length,2,'token renovado depois do 401');
});

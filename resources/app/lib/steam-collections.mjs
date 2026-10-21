import fs from 'node:fs';import path from 'node:path';
export function collectionWrites(dir,account,add,remove=[]){
 const base=path.join(dir,'userdata',account,'config/cloudstorage'),file=path.join(base,'cloud-storage-namespace-1.json'),versionsFile=path.join(base,'cloud-storage-namespaces.json');
 const read=(p,fallback)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):fallback;
 const entries=read(file,[]),versions=read(versionsFile,[]);if(!Array.isArray(entries)||entries.some(e=>!Array.isArray(e)||typeof e[0]!=='string'||!e[1]||typeof e[1]!=='object')||!Array.isArray(versions)||versions.some(v=>!Array.isArray(v)||v.length!==2))throw Error('Formato das coleções Steam não reconhecido; nenhum arquivo foi aplicado.');
 let index=entries.findIndex(([key,e])=>{if(!key.startsWith('user-collections.')||e.is_deleted||!e.value)return false;try{const c=JSON.parse(e.value);return ['SteamTaiga','Taiga Launcher'].includes(c.name)&&!c.filterSpec&&Array.isArray(c.added);}catch{return false;}}),key=index<0?'user-collections.taiga-steamtaiga':entries[index][0],previous=index<0?{}:entries[index][1];
 if(index<0&&!add.length)return [];if(index<0&&entries.some(([k])=>k==='user-collections.taiga-steamtaiga'))throw Error('Existe uma coleção Taiga Launcher em formato incompatível. Confira a coleção na Steam antes de aplicar.');
 const value=previous.value?JSON.parse(previous.value):{id:'taiga-steamtaiga',name:'Taiga Launcher',added:[],removed:[]};if(value.name==='SteamTaiga')value.name='Taiga Launcher';const removed=new Set(remove.map(Number)),added=new Set(add.map(Number));value.added=[...new Set([...(value.added||[]).map(Number).filter(id=>!removed.has(id)),...added])];value.removed=[...new Set([...(value.removed||[]).map(Number).filter(id=>!added.has(id)),...removed])];
 if(previous.value===JSON.stringify(value))return [];
 const max=Math.max(0,...entries.map(([,e])=>Number(e.version)||0),...versions.filter(v=>Array.isArray(v)&&Number(v[0])===1).map(v=>Number(v[1])||0))+1;
 const entry=[key,{...previous,key,timestamp:Math.floor(Date.now()/1000),version:String(max),value:JSON.stringify(value),conflictResolutionMethod:'custom',strMethodId:'union-collections'}];delete entry[1].is_deleted;if(index<0)entries.push(entry);else entries[index]=entry;
 const vi=versions.findIndex(v=>Array.isArray(v)&&Number(v[0])===1);if(vi<0)versions.push([1,String(max)]);else versions[vi]=[1,String(max)];
 return [[file,Buffer.from(JSON.stringify(entries))],[versionsFile,Buffer.from(JSON.stringify(versions))]];
}

// Apaga a coleção "Taiga Launcher" (ou a antiga "SteamTaiga") da conta: usado em "Remover tudo da Steam".
export function collectionDelete(dir,account){
 const base=path.join(dir,'userdata',account,'config/cloudstorage'),file=path.join(base,'cloud-storage-namespace-1.json'),versionsFile=path.join(base,'cloud-storage-namespaces.json');
 if(!fs.existsSync(file))return [];const entries=JSON.parse(fs.readFileSync(file,'utf8')),versions=fs.existsSync(versionsFile)?JSON.parse(fs.readFileSync(versionsFile,'utf8')):[];
 const hits=entries.map((e,i)=>[e,i]).filter(([[key,e]])=>{if(!String(key).startsWith('user-collections.')||e?.is_deleted)return false;if(key==='user-collections.taiga-steamtaiga')return true;try{const c=JSON.parse(e.value);return ['SteamTaiga','Taiga Launcher'].includes(c.name)&&!c.filterSpec;}catch{return false;}});
 if(!hits.length)return [];let max=Math.max(0,...entries.map(([,e])=>Number(e?.version)||0),...versions.filter(v=>Array.isArray(v)&&Number(v[0])===1).map(v=>Number(v[1])||0));
 for(const [[key],i] of hits){max++;entries[i]=[key,{key,timestamp:Math.floor(Date.now()/1000),is_deleted:true,version:String(max)}];}
 const vi=versions.findIndex(v=>Array.isArray(v)&&Number(v[0])===1);if(vi<0)versions.push([1,String(max)]);else versions[vi]=[1,String(max)];
 return [[file,Buffer.from(JSON.stringify(entries))],[versionsFile,Buffer.from(JSON.stringify(versions))]];
}

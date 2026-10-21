import fs from 'node:fs';
import path from 'node:path';
import {atomic,save} from './files.mjs';
// Only exact artwork stems owned by the current synchronization are eligible.
export function obsoleteArtwork(grid,destinations){
 if(!fs.existsSync(grid))return [];
 const stems=new Map(destinations.filter(f=>/\.(png|jpe?g|webp|tga|ico)$/i.test(f)).map(f=>[path.basename(f,path.extname(f)).toLowerCase(),path.basename(f)]));
 return fs.readdirSync(grid).filter(name=>/\.(png|jpe?g|webp|tga|ico)$/i.test(name)&&stems.has(path.basename(name,path.extname(name)).toLowerCase())&&(process.platform==='win32'?stems.get(path.basename(name,path.extname(name)).toLowerCase()).toLowerCase()!==name.toLowerCase():stems.get(path.basename(name,path.extname(name)).toLowerCase())!==name)).map(name=>path.join(grid,name));
}
export function commitSteamFiles(writes,deletes,backupDir,{write=atomic}={}){
 const destinations=new Set(writes.map(([file])=>file));deletes=[...new Set(deletes)].filter(file=>!destinations.has(file));
 const changes=writes.filter(([file,bytes])=>!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes));
 const files=[...new Set([...changes.map(([file])=>file),...deletes])],entries=[];if(!files.length)return {changed:0,removed:0};
 fs.mkdirSync(backupDir,{recursive:true});
 for(const [i,file] of files.entries()){const backup=path.join(backupDir,String(i)+'.bak'),exists=fs.existsSync(file);if(exists)fs.copyFileSync(file,backup);entries.push({file,backup:exists?backup:null});}
 save(path.join(backupDir,'manifest.json'),{status:'prepared',entries});
 try{
  for(const [file,bytes] of changes)write(file,bytes);
  for(const file of deletes)if(fs.existsSync(file))fs.unlinkSync(file);
  for(const [file,bytes] of changes)if(!fs.readFileSync(file).equals(bytes))throw Error('A verificação de gravação falhou.');
  save(path.join(backupDir,'manifest.json'),{status:'committed',entries});
 }catch(error){const failures=[];for(const entry of [...entries].reverse())try{if(entry.backup)atomic(entry.file,fs.readFileSync(entry.backup));else if(fs.existsSync(entry.file))fs.unlinkSync(entry.file);}catch{failures.push(entry.file);}save(path.join(backupDir,'manifest.json'),{status:failures.length?'recovery-needed':'rolled-back',entries,failures});throw Error(error.message+(failures.length?' Recuperação manual necessária; consulte o backup.':' Alterações desta aplicação desfeitas.'));}
 return {changed:changes.length,removed:deletes.length};
}

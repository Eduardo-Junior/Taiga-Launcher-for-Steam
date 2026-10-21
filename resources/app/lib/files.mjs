import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export function atomic(file, bytes) {
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const tmp=file+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';
 try { fs.writeFileSync(tmp,bytes,{mode:0o600}); fs.renameSync(tmp,file); }
 finally { if(fs.existsSync(tmp))fs.unlinkSync(tmp); }
}
export function json(file,fallback){if(!fs.existsSync(file))return fallback; return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
export function save(file,value){atomic(file,JSON.stringify(value,null,2));}
export const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const digest=s=>crypto.createHash('sha256').update(s).digest('hex');

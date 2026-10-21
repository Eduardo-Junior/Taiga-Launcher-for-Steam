import fs from 'node:fs';
import path from 'node:path';
import {inflateRawSync} from 'node:zlib';
import {digest} from './files.mjs';
export function parseSFO(b){
 if(b.length<20||b.readUInt32LE(0)!==0x46535000)throw Error('PARAM.SFO inválido');
 const keys=b.readUInt32LE(8),data=b.readUInt32LE(12),n=b.readUInt32LE(16),out={};
 if(n>4096||20+n*16>b.length)throw Error('Índice SFO inválido');
 for(let i=0;i<n;i++){
  const p=20+i*16,k=keys+b.readUInt16LE(p),fmt=b.readUInt16LE(p+2),len=b.readUInt32LE(p+4),v=data+b.readUInt32LE(p+12);
  const end=b.indexOf(0,k);if(k>=b.length||end<k||v+len>b.length)throw Error('SFO truncado');
  const name=b.toString('utf8',k,end);
  out[name]=fmt===0x404&&len===4?b.readUInt32LE(v):b.toString('utf8',v,v+len).replace(/\0.*$/s,'');
 }return out;
}
export function reader(file){
 const fd=fs.openSync(file,'r'),size=fs.fstatSync(fd).size;
 function raw(at,n){if(n<0||n>32*1024*1024||at<0||at+n>size)throw Error('Imagem truncada');const b=Buffer.alloc(n);if(fs.readSync(fd,b,0,n,at)!==n)throw Error('Leitura incompleta');return b;}
 try {
 const h=raw(0,Math.min(size,24));
 if(h.toString('ascii',0,4)!=='CISO')return {read:raw,close:()=>fs.closeSync(fd)};
 const header=h.readUInt32LE(4),total=Number(h.readBigUInt64LE(8)),block=h.readUInt32LE(16),version=h[20],align=h[21];
 if(version!==1||block<2048||block>1024*1024||align>20||!Number.isSafeInteger(total))throw Error('CSO: somente formato CISO v1 é aceito');
 function read(at,n){
  if(at+n>total||n>16*1024*1024)throw Error('CSO inválido');const result=Buffer.alloc(n);let done=0;
  while(done<n){const bi=Math.floor((at+done)/block),off=(at+done)%block,ix=raw(header+bi*4,8),a=ix.readUInt32LE(0),z=ix.readUInt32LE(4),pos=(a&0x7fffffff)*2**align,next=(z&0x7fffffff)*2**align;
   const packed=raw(pos,next-pos);const bytes=(a&0x80000000)?packed:inflateRawSync(packed,{maxOutputLength:block});
   const take=Math.min(n-done,block-off);if(bytes.length<off+take)throw Error('Bloco CSO incompleto');bytes.copy(result,done,off,off+take);done+=take;
  }return result;
 }return {read,close:()=>fs.closeSync(fd)};
 }catch(e){fs.closeSync(fd);throw e;}
}
export function isoFile(read,parts){
 const pvd=read(16*2048,2048);if(pvd.toString('ascii',1,6)!=='CD001')throw Error('ISO9660 não reconhecido');
 let rec=pvd.subarray(156,190);
 for(const part of parts){
  const extent=rec.readUInt32LE(2),size=rec.readUInt32LE(10);if(size>8*1024*1024)throw Error('Diretório ISO excessivo');
  const dir=read(extent*2048,size);let found;
  for(let i=0;i<dir.length;){const len=dir[i];if(!len){i=(Math.floor(i/2048)+1)*2048;continue;}if(len<34||i+len>dir.length)throw Error('Diretório ISO inválido');
   const r=dir.subarray(i,i+len),name=r.toString('ascii',33,33+r[32]).replace(/;\d+$/,'');if(name.toUpperCase()===part.toUpperCase()){found=r;break;}i+=len;
  }if(!found)return null;rec=found;
 }const size=rec.readUInt32LE(10);if(size>8*1024*1024)throw Error('Metadados excessivos');return read(rec.readUInt32LE(2)*2048,size);
}
export function inspectPSP(file){
 file=fs.realpathSync(file);const stat=fs.statSync(file),ext=path.extname(file).toLowerCase();
 if(!stat.isFile()||stat.size<40||!['.iso','.cso','.pbp'].includes(ext))throw Error('Selecione uma ISO, CSO ou PBP de PSP válida (arquivo vazio não é aceito).');
 const r=reader(file);let sfo,icon;
 try{
  if(ext==='.pbp'){
   const h=r.read(0,40);if(h.readUInt32LE(0)!==0x50425000)throw Error('PBP inválido');
   const a=h.readUInt32LE(8),b=h.readUInt32LE(12),c=h.readUInt32LE(16);sfo=r.read(a,b-a);if(c>b)icon=r.read(b,c-b);
  }else{sfo=isoFile(r.read,['PSP_GAME','PARAM.SFO']);icon=isoFile(r.read,['PSP_GAME','ICON0.PNG']);}
  if(!sfo)throw Error('Não foi encontrado PSP_GAME/PARAM.SFO');const meta=parseSFO(sfo);
  if(ext==='.pbp'&&meta.CATEGORY==='ME')throw Error('Este PBP é de PS1, não de PSP.');
  if(['SD','MS','PG'].includes(meta.CATEGORY))throw Error('Arquivo de save ou atualização; selecione o jogo base.');
  const title=String(meta.TITLE||path.basename(file,ext)).replace(/[\r\n]+/g,' ').trim();
  return {id:digest(file.toLowerCase()).slice(0,20),path:file,title,discId:String(meta.DISC_ID||''),platform:'PSP',identitySource:meta.TITLE&&meta.DISC_ID?'PARAM.SFO':null,internalTitle:meta.TITLE||null,revision:meta.DISC_VERSION||null,bytes:stat.size,mtime:stat.mtimeMs,icon:icon?.subarray(1,4).toString()==='PNG'?icon:null};
 }finally{r.close();}
}
export function scan(root){
 const out=[];let visited=0;
 function walk(p,depth){if(depth>12||++visited>30000)throw Error('Pasta muito grande. Selecione uma pasta mais específica.');
  const st=fs.lstatSync(p);if(st.isSymbolicLink())return;
  if(st.isDirectory()){for(const e of fs.readdirSync(p))walk(path.join(p,e),depth+1);}
  else if(/\.(iso|cso|pbp)$/i.test(p))out.push(p);
 }walk(root,0);return out;
}

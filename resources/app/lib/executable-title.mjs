import fs from 'node:fs';
// Read only the bounded PE resource section. Never execute a selected program.
export function executableTitle(file){
 const fd=fs.openSync(file,'r');
 try{
  const size=fs.fstatSync(fd).size;
  const read=(at,n)=>{if(at<0||n<0||n>8*1024*1024||at+n>size)throw Error();const b=Buffer.alloc(n);if(fs.readSync(fd,b,0,n,at)!==n)throw Error();return b;};
  const dos=read(0,64);if(dos.toString('ascii',0,2)!=='MZ')return null;
  const at=dos.readUInt32LE(60),pe=read(at,24);if(pe.readUInt32LE(0)!==0x4550)return null;
  const count=pe.readUInt16LE(6),opt=pe.readUInt16LE(20);if(count>96)return null;
  const sections=read(at+24+opt,count*40);
  for(let i=0;i<count;i++){const h=sections.subarray(i*40,(i+1)*40);if(h.toString('ascii',0,8).replace(/\0/g,'')!=='.rsrc')continue;
   const bytes=read(h.readUInt32LE(20),h.readUInt32LE(16));
   for(const key of ['ProductName','FileDescription']){const needle=Buffer.from(key+'\0','utf16le');let from=0;
    while(from<bytes.length){const index=bytes.indexOf(needle,from);if(index<0)break;from=index+needle.length;if(index<6)continue;const start=index-6,length=bytes.readUInt16LE(start),chars=bytes.readUInt16LE(start+2),type=bytes.readUInt16LE(start+4),value=(index+needle.length+3)&~3;
     if(type!==1||chars<3||chars>200||length<6||start+length>bytes.length||value+chars*2>start+length)continue;
     const title=bytes.toString('utf16le',value,value+chars*2).replace(/\0.*$/s,'').trim();
     if(title.length>2&&!/^(?:game|application|launcher|bootstrap|unreal engine|unity|setup|installer|microsoft)/i.test(title)&&!/[\x00-\x1f]/.test(title))return title;
    }
   }
  }
 }catch{}finally{fs.closeSync(fd);}return null;
}

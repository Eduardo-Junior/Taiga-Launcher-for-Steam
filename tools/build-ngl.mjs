// Gera resources/app/steam/ngl.bundle.js a partir do código do NativeGameLink for Steam (MIT) em
// third_party/nativegamelink. Mesmo formato do pacote Millennium: React vem de window.SP_REACT e a API
// "@steambrew/client" vem de window.MILLENNIUM_API, que no Taiga Launcher é fornecida por steam/ngl-host.js.
import path from 'node:path';import fs from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const req=createRequire(import.meta.url);
let esbuild;for(const p of [process.env.ESBUILD_PATH,'esbuild','/opt/npm-tools/node_modules/esbuild'].filter(Boolean)){try{esbuild=req(p);break;}catch{}}
if(!esbuild)throw Error('esbuild não encontrado (defina ESBUILD_PATH).');
const globals={react:'window.SP_REACT','react-dom':'window.SP_REACTDOM','@steambrew/client':'window.__TAIGA_MILLENNIUM_API__'};
const globalsPlugin={name:'globals',setup(b){b.onResolve({filter:/^(react|react-dom|@steambrew\/client)$/},a=>({path:a.path,namespace:'g'}));b.onLoad({filter:/.*/,namespace:'g'},a=>({contents:`module.exports=${globals[a.path]};`,loader:'js'}));}};
const prod=!process.argv.includes('--dev');
const out=path.join(root,'resources/app/steam/ngl.bundle.js');
const result=await esbuild.build({entryPoints:[path.join(root,'third_party/nativegamelink/frontend/index.tsx')],bundle:true,format:'iife',globalName:'__TAIGA_NGL_MODULE__',platform:'browser',target:'chrome110',jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',minify:prod,legalComments:'none',charset:'utf8',plugins:[globalsPlugin],write:false,logLevel:'warning',define:{'process.env.NODE_ENV':'"production"'}});
const banner='/* NativeGameLink for Steam 4.0.3, Copyright (c) 2026 David Miranda (MIT). Adaptado e empacotado pelo Taiga Launcher. */\n';
fs.writeFileSync(out,banner+result.outputFiles[0].text);
console.log('ngl.bundle.js',(fs.statSync(out).size/1024).toFixed(0)+' KB');

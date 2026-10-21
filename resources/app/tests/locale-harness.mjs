import fs from 'node:fs';
export const localeSource=()=>fs.readFileSync(new URL('../locales/catalog.cjs',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../locales/runtime.cjs',import.meta.url),'utf8')+'\n';
export const clientSource=()=>localeSource()+fs.readFileSync(new URL('../web/achievement-view.cjs',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('../web/app.js',import.meta.url),'utf8');

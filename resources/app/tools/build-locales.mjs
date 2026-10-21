import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../locales'),languages=['pt-BR','en','es','fr','de'],messages={};let keys;
for(const language of languages){const rows=JSON.parse(fs.readFileSync(path.join(root,language+'.json'),'utf8'));if(keys&&JSON.stringify(Object.keys(rows).sort())!==JSON.stringify(keys))throw Error('Locale keys differ: '+language);keys=Object.keys(rows).sort();for(const [key,text] of Object.entries(rows)){messages[key]||={};messages[key][language]=text;}}
// Mensagens do servidor (escritas em português no código): cada linha é [pt-BR, en, es, fr, de]. O cliente e as
// páginas injetadas traduzem pelo texto, inclusive com partes variáveis ({0}, {1}...).
const {createHash}=await import('node:crypto'),seen=new Set();
for(const row of JSON.parse(fs.readFileSync(path.join(root,'server-messages.json'),'utf8'))){if(row.length!==languages.length||row.some(t=>typeof t!=='string'||!t))throw Error('Linha incompleta: '+row[0]);if(seen.has(row[0]))throw Error('Mensagem repetida: '+row[0]);seen.add(row[0]);const key='srv.'+createHash('sha1').update(row[0]).digest('hex').slice(0,12);messages[key]={};languages.forEach((language,i)=>{messages[key][language]=row[i];});}
fs.writeFileSync(path.join(root,'catalog.cjs'),`(function(root){const messages=${JSON.stringify(messages)};if(typeof document==='undefined')module.exports=messages;else root.TaigaMessages=messages;})(globalThis);\n`);
console.log(languages.length+' languages, '+keys.length+' keys, '+seen.size+' server messages');

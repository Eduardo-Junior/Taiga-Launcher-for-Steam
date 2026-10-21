import path from 'node:path';
import {digest,json,save} from './files.mjs';
export function translationChunks(text,maxBytes=450){const chunks=[];let chunk='';for(const word of String(text).split(/(\s+)/)){if(Buffer.byteLength(chunk+word)>maxBytes){if(chunk.trim())chunks.push(chunk.trim());chunk='';for(const char of word){if(Buffer.byteLength(chunk+char)>maxBytes){chunks.push(chunk);chunk='';}chunk+=char;}}else chunk+=word;}if(chunk.trim())chunks.push(chunk.trim());return chunks;}
// Idioma de um texto pelas palavras mais comuns de cada língua (o campo "idioma" gravado nem sempre é confiável:
// um texto em inglês podia ficar marcado como português e nunca era traduzido).
const STOP={'pt-BR':'de do da dos das que e com para um uma os as não seu sua ao na no nas nos em se mais por como é ele ela foi'.split(' '),en:'the and of to in is with his her that for a an as by from on its this are be it their he she was'.split(' '),es:'el la los las del y que con para una su sus en por como es se al lo más pero'.split(' '),fr:'le la les des et est une du pour dans avec un sur au aux que qui son sa ses ce il elle'.split(' '),de:'der die das und ist mit ein eine zu den für von im dem auf sich nicht des als auch'.split(' ')};
export function detectLanguage(text){const words=String(text||'').toLowerCase().match(/[a-zà-ÿ]+/g)||[];if(words.length<6)return null;const score={};for(const [lang,list] of Object.entries(STOP)){const set=new Set(list);score[lang]=words.filter(w=>set.has(w)).length/words.length;}
 if(/[ãõ]|ção\b|ções\b/.test(String(text).toLowerCase()))score['pt-BR']+=.05;if(/ñ|¿|¡/.test(text))score.es+=.05;if(/ß|[äöü]/.test(String(text).toLowerCase()))score.de+=.05;
 const [best,value]=Object.entries(score).sort((a,b)=>b[1]-a[1])[0];return value>=.08?best:null;}
export function looksPortuguese(text){const d=detectLanguage(text);if(d)return d==='pt-BR';return /\b(voc[eê]|jogos?|hist[oó]ria|aventura|combate|corridas?|personagens|mundo|explore|lan[çc]amento|tambores|ritmo)\b|[ãõç]/iu.test(text);}
export const translatePortuguese=(text,dir,request)=>translateText(text,dir,request,'pt-BR','en');
// Tradução gratuita, sem chave: primeiro o tradutor público do Google (translate.googleapis.com, cliente "gtx",
// o mesmo usado por plugins do Playnite), cota generosa e detecção do idioma de origem; o MyMemory fica como
// reserva (a cota gratuita dele é pequena e acabava no meio das listas de conquistas). Resultado em cache permanente.
const GOOGLE_LANG = {'pt-BR': 'pt', pt: 'pt', en: 'en', es: 'es', fr: 'fr', de: 'de'};
export async function googleTranslate(text, target, source = 'auto', fetchImpl = (...a) => fetch(...a)) {
 const out = [];
 for (const q of translationChunks(text, 1800)) {
  const url = 'https://translate.googleapis.com/translate_a/single?' + new URLSearchParams({client: 'gtx', sl: GOOGLE_LANG[source] || 'auto', tl: GOOGLE_LANG[target] || target, dt: 't', q});
  const res = await fetchImpl(url, {signal: AbortSignal.timeout(15000), headers: {'User-Agent': 'Mozilla/5.0'}});
  if (!res.ok) throw Error('Tradução indisponível (HTTP ' + res.status + ').');
  const data = await res.json(); const parts = Array.isArray(data?.[0]) ? data[0].map(x => Array.isArray(x) ? x[0] : '').filter(x => typeof x === 'string') : [];
  if (!parts.length) throw Error('Tradução indisponível.');
  out.push(parts.join(''));
 }
 return out.join(' ');
}
const googleEnabled = () => !process.env.TAIGA_OFFLINE && process.env.TAIGA_TRANSLATE_GOOGLE !== '0';
// 2.3.0: tradutor da Microsoft usado pelo próprio navegador Edge (sem chave, cota alta e até 100 textos por pedido).
// Ordem: Microsoft → Google → MyMemory. O que não sair agora fica marcado e é tentado de novo depois (retryLater).
const MS_LANG = {'pt-BR': 'pt', pt: 'pt', en: 'en', es: 'es', fr: 'fr', de: 'de'};
let msToken = null;
let msDownUntil = 0;
const msEnabled = () => !process.env.TAIGA_OFFLINE && process.env.TAIGA_TRANSLATE_MS !== '0' && Date.now() > msDownUntil;
async function msAuth(fetchImpl) {
 if (msToken && msToken.until > Date.now()) return msToken.value;
 const res = await fetchImpl('https://edge.microsoft.com/translate/auth', {signal: AbortSignal.timeout(10000), headers: {'User-Agent': 'Mozilla/5.0'}});
 const value = (await res.text()).trim(); if (!res.ok || !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(value)) throw Error('Tradutor da Microsoft indisponível.');
 msToken = {value, until: Date.now() + 8 * 60000}; return value;
}
export async function microsoftTranslate(texts, target, source = 'auto', fetchImpl = (...a) => fetch(...a)) {
 try { return await msTranslate(texts, target, source, fetchImpl); } catch (e) { msDownUntil = Date.now() + 10 * 60000; throw e; }
}
async function msTranslate(texts, target, source, fetchImpl) {
 const list = texts.map(t => String(t || ''));
 const out = new Array(list.length).fill('');
 // Lotes de até 100 textos e ~40 mil caracteres.
 const batches = []; let cur = [], size = 0;
 list.forEach((t, i) => { if (!t.trim()) return; if (cur.length && (cur.length >= 100 || size + t.length > 40000)) { batches.push(cur); cur = []; size = 0; } cur.push(i); size += t.length; });
 if (cur.length) batches.push(cur);
 for (const b of batches) {
  const params = new URLSearchParams({'api-version': '3.0', to: MS_LANG[target] || target}); if (source && source !== 'auto') params.set('from', MS_LANG[source] || source);
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
   const token = await msAuth(fetchImpl);
   res = await fetchImpl('https://api-edge.cognitive.microsofttranslator.com/translate?' + params, {method: 'POST', signal: AbortSignal.timeout(20000), headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify(b.map(i => ({Text: list[i]})))});
   if (res.status === 401) { msToken = null; continue; } break;
  }
  if (!res.ok) throw Error('Tradutor da Microsoft respondeu HTTP ' + res.status + '.');
  const data = await res.json();
  if (!Array.isArray(data) || data.length !== b.length) throw Error('Resposta inesperada do tradutor.');
  b.forEach((i, k) => { out[i] = String(data[k]?.translations?.[0]?.text || ''); });
 }
 return out;
}
// Textos que não puderam ser traduzidos agora (cota, sem internet): o programa tenta de novo sozinho mais tarde.
const pending = new Set();
export const translationPending = () => pending.size;
export function clearPending() { pending.clear(); }
export async function translateText(text,dir,request,target='pt-BR',source='en'){
 if(!['pt-BR','en','es','fr','de'].includes(target)||!['pt-BR','pt','en','es','fr','de','auto'].includes(source))throw Error('Idioma inválido.');
 if(target===source)return String(text||'');if(!text)return '';
 const file=path.join(dir,'cache',(target==='pt-BR'&&source==='en'?'pt-':'translation-'+source+'-'+target+'-')+digest(text)+'.json'),cached=json(file,null);if(cached?.text)return cached.text;
 let translated='';
 if(msEnabled())try{translated=(await microsoftTranslate([text],target,source))[0];}catch{}
 if(!translated&&googleEnabled())try{translated=await googleTranslate(text,target,source);}catch{}
 if(!translated){
  if(source==='auto'){pending.add(file);throw Error('Tradução indisponível no momento. Tente novamente mais tarde.');}
  const result=[];for(const q of translationChunks(text)){const r=await request('https://api.mymemory.translated.net/get?'+new URLSearchParams({q,langpair:source+'|'+target}));const t=r?.responseData?.translatedText;if(Number(r.responseStatus)!==200||!t||/MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR/i.test(t)){pending.add(file);throw Error('Tradução indisponível ou limite gratuito atingido. Tente novamente mais tarde.');}result.push(t.replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));}
  translated=result.join(' ');
 }
 save(file,{text:translated});return translated;
}
// Vários textos curtos de uma vez (listas de conquistas): uma linha por texto, poucas consultas em vez de uma por
// texto. Cada texto continua no mesmo cache de translateText. Se a resposta não vier com o mesmo número de linhas,
// cai para a tradução um a um.
export async function translateMany(texts,dir,request,target='pt-BR',source='en'){
 const out=texts.map(t=>String(t||''));if(target===source)return out;
 const fileOf=text=>path.join(dir,'cache',(target==='pt-BR'&&source==='en'?'pt-':'translation-'+source+'-'+target+'-')+digest(text)+'.json');
 const todo=[];out.forEach((t,i)=>{if(!t.trim())return;const c=json(fileOf(t),null);if(c?.text)out[i]=c.text;else todo.push(i);});
 if(!todo.length)return out;
 if(msEnabled())try{const r=await microsoftTranslate(todo.map(i=>out[i]),target,source);const done=[];todo.forEach((i,k)=>{if(r[k]){save(fileOf(texts[i]),{text:r[k]});out[i]=r[k];done.push(i);}});if(done.length===todo.length)return out;todo.splice(0,todo.length,...todo.filter(i=>!done.includes(i)));}catch{}
 const groups=[];let cur=[],size=0;for(const i of todo){const line=out[i].replace(/\s*\n\s*/g,' ');const b=Buffer.byteLength(line)+1;if(cur.length&&(size+b>1500||cur.length>=40)){groups.push(cur);cur=[];size=0;}cur.push(i);size+=b;}if(cur.length)groups.push(cur);
 for(const g of groups){let lines=null;
  if(googleEnabled())try{const r=await googleTranslate(g.map(i=>out[i].replace(/\s*\n\s*/g,' ')).join('\n'),target,source);const parts=r.split(/\n/).map(s=>s.trim());if(parts.length===g.length&&parts.every(Boolean))lines=parts;}catch{}
  if(lines){g.forEach((i,k)=>{save(fileOf(texts[i]),{text:lines[k]});out[i]=lines[k];});continue;}
  for(const i of g){try{out[i]=await translateText(texts[i],dir,request,target,source);}catch{out.failed=(out.failed||0)+1;}}
 }
 return out;
}

(function(root){
'use strict';
const messages=typeof document==='undefined'?require('./catalog.cjs'):root.TaigaMessages;
const languages=[{id:'pt-BR',name:'Português do Brasil',flag:'🇧🇷'},{id:'en',name:'English',flag:'🇺🇸'},{id:'es',name:'Español',flag:'🇪🇸'},{id:'fr',name:'Français',flag:'🇫🇷'},{id:'de',name:'Deutsch',flag:'🇩🇪'}];
const lookup=new Map(Object.entries(messages).map(([key,row])=>[row['pt-BR'],key]));
// Mensagens do servidor saem em português com partes variáveis (nome do jogo, caminho, número). Cada texto do
// catálogo com {marcadores} vira um molde; o valor capturado é traduzido também quando for outra mensagem conhecida.
const escapeRe=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.entries(messages).filter(([,row])=>/\{\w+\}/.test(row['pt-BR']||'')).map(([key,row])=>{const source=row['pt-BR'],names=[];const re=new RegExp('^'+source.split(/(\{\w+\})/).map(part=>{const m=part.match(/^\{(\w+)\}$/);if(m){names.push(m[1]);return '([\\s\\S]+?)';}return escapeRe(part);}).join('')+'$');return {key,re,names,fixed:source.replace(/\{\w+\}/g,'').length};}).filter(t=>t.fixed>=4).sort((a,b)=>b.fixed-a.fixed);
function create(initial='pt-BR'){let language=languages.some(l=>l.id===initial)?initial:'en';const api={get language(){return language;},setLanguage(value){language=languages.some(l=>l.id===value)?value:'en';},t(key,params={}){const row=messages[key],text=row?.[language]||row?.en||row?.['pt-BR']||key;return String(text).replace(/\{([\w]+)\}/g,(whole,name)=>params[name]===undefined?whole:String(params[name]));},text(value){const text=String(value??'');if(language==='pt-BR'||!text.trim())return text;const whole=translate(text,0);if(whole!==null)return whole;const parts=text.split(/(?<=[.!?:])\s+(?=[A-ZÀ-Ú"“(])/);if(parts.length<2)return text;return parts.map(part=>translate(part,0)??part).join(' ');}};
 function translate(text,depth){const trimmed=text.trim();if(!trimmed)return text;const key=lookup.get(trimmed);if(key)return text.replace(trimmed,api.t(key));if(depth>2||trimmed.length>600)return null;for(const t of templates){const m=trimmed.match(t.re);if(!m)continue;const params={};t.names.forEach((name,i)=>{params[name]=translate(m[i+1],depth+1)??m[i+1];});return text.replace(trimmed,api.t(t.key,params));}return null;}
 return api;}
const api={create,languages};if(typeof document==='undefined')module.exports=api;else root.TaigaLocales=api;
})(globalThis);

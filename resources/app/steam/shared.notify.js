/* Taiga Launcher, notificação nativa de conquista no contexto principal da Steam (SharedJSContext).
   Mesma técnica do NativeGameLink for Steam (MIT): monta a mensagem protobuf CClientNotificationAchievement
   encontrada no webpack da Steam e entrega ao NotificationStore como uma notificação de conquista (tipo 5),
   com o som padrão. Se a Steam mudar e algo não for encontrado, devolve false e o Taiga Launcher usa a
   notificação própria da página. */
(()=>{
 'use strict';
 const TYPE=5,DURATION=5000;let proto=null,storeRef=null,nextId=-7000,active=null;
 function webpackModules(){const chunk=window.webpackChunksteamui||window.webpackChunk;if(!chunk||typeof chunk.push!=='function')return [];let req=null;try{chunk.push([[Symbol('taiga-notify')],{},r=>{req=r;}]);}catch{return [];}const out=[];for(const id of Object.keys(req?.c||{})){const e=req.c[id]?.exports;if(!e)continue;out.push(e);if(typeof e==='object')for(const v of Object.values(e))if(v&&(typeof v==='object'||typeof v==='function'))out.push(v);}return out;}
 function findProto(){if(proto)return proto;for(const c of webpackModules()){try{if(typeof c?.fromObject==='function'&&typeof c?.prototype?.getClassName==='function'&&c.prototype.getClassName.call(c.prototype)==='CClientNotificationAchievement'){proto=c;break;}}catch{}}return proto;}
 function findStore(){if(storeRef)return storeRef;const ok=s=>typeof s?.OnNotification==='function'&&Array.isArray(s.m_rgNotificationToasts)&&Array.isArray(s.m_rgNotificationTray);if(ok(window.NotificationStore))return storeRef=window.NotificationStore;for(const c of webpackModules())if(ok(c))return storeRef=c;return null;}
 function retireTray(store,id){try{for(const group of [...store.m_rgNotificationTray]){const list=group.notifications||[];const i=list.findIndex(n=>n.notificationID===id);if(i<0)continue;list.splice(i,1);if(!list.length)store.m_rgNotificationTray.splice(store.m_rgNotificationTray.indexOf(group),1);}store.m_cbkNotificationTray?.Dispatch?.(store.m_rgNotificationTray);}catch{}}
 function sound(){try{const s=window.SteamClient?.Sounds;if(typeof s?.PlaySound==='function')s.PlaySound(5);else if(typeof s?.PlayNavSound==='function')s.PlayNavSound(5);}catch{}}
 window.__TAIGA_NOTIFY__=async payload=>{
  try{
   const P=findProto(),store=findStore();if(!P||!store)return false;
   const msg=P.fromObject({achievement_id:String(payload.id||''),appid:Number(payload.appid)||0,name:String(payload.title||''),description:String(payload.description||''),image_url:String(payload.icon||''),achieved:true,rtime_unlocked:Math.floor((Date.parse(payload.date||'')||Date.now())/1000),min_progress:0,current_progress:0,max_progress:0,global_achieved_pct:Number(payload.globalPercent)||0});
   const binary=msg?.serializeBinary?.();if(!binary)return false;
   const id=nextId--;
   if(active){try{store.ExpireToast?.(active);}catch{}active=null;}
   store.OnNotification(id,TYPE,binary);retireTray(store,id);
   const toast=store.m_rgNotificationToasts.find(n=>n.notificationID===id);if(!toast)return false;
   active=toast;setTimeout(()=>{if(active===toast){try{store.ExpireToast?.(toast);}catch{}active=null;}},DURATION);
   sound();return true;
  }catch{return false;}
 };
})();

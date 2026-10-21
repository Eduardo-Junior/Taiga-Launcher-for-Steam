/* Taiga Launcher, inicia o NativeGameLink for Steam (MIT) dentro da Steam depois do host e do pacote. */
(function () {
 'use strict';
 const log = msg => { try { if (typeof window.__taiga_ffi__ === 'function') window.__taiga_ffi__(JSON.stringify({id: 0, method: 'fe_log', args: {msg: String(msg).slice(0, 4000)}})); } catch (e) {} };
 window.__TAIGA_SET_CATALOG__ = catalog => { window.__TAIGA_CATALOG__ = catalog && typeof catalog === 'object' ? catalog : {}; };
 if (window.PLUGIN_LIST && window.PLUGIN_LIST.NativeGameLinkForSteam) { window.__TAIGA_NGL_STATE__ = 'millennium'; log('NativeGameLink do Millennium já está ativo; o Taiga Launcher não carrega uma segunda cópia.'); return; }
 if (window.__TAIGA_NGL_PLUGIN__ || window.__TAIGA_NGL_STATE__ === 'starting') return;
 const mod = window.__TAIGA_NGL_MODULE__;
 const entry = mod && (typeof mod.default === 'function' ? mod.default : typeof mod === 'function' ? mod : null);
 if (!entry) { window.__TAIGA_NGL_STATE__ = 'missing'; log('Pacote do NativeGameLink ausente.'); return; }
 window.__TAIGA_NGL_STATE__ = 'starting';
 // Artes escolhidas na própria Steam passam a valer também no Taiga Launcher.
 window.addEventListener('gdl:artwork-changed', event => {
  const d = event && event.detail || {};
  if (window.__TAIGA_NGL_HOST__) window.__TAIGA_NGL_HOST__.call('taiga_artwork_changed', {user: !d.automatic && !!(d.user_action || d.user_choice), shortcut_app_id: String(d.shortcutAppId || ''), steam_app_id: String(d.steamAppId || '')}).catch(() => {});
 });
 // Depois de um recarregamento da Steam o contexto fica pronto antes da interface: espera webpack, React,
 // gerenciador de janelas e lojas da Steam, como o Millennium faz antes de iniciar os plugins.
 const steamReady = () => !!(window.SP_REACT && window.g_PopupManager && window.SteamClient);
 const waitSteam = () => new Promise(resolve => { const tick = () => { if (steamReady()) resolve(); else setTimeout(tick, 200); }; tick(); });
 waitSteam().then(() => entry()).then(plugin => {
  window.__TAIGA_NGL_PLUGIN__ = plugin || {};
  window.__TAIGA_NGL_VERSION__ = window.__TAIGA_NGL_WANT__ || '';
  window.__TAIGA_NGL_STATE__ = 'ready';
  log('NativeGameLink iniciado pelo Taiga Launcher (pacote ' + (window.__TAIGA_NGL_WANT__ || '?') + ').');
 }).catch(error => {
  window.__TAIGA_NGL_STATE__ = 'error';
  window.__TAIGA_NGL_ERROR__ = String(error && (error.stack || error.message) || error);
  log('Falha ao iniciar o NativeGameLink: ' + window.__TAIGA_NGL_ERROR__);
 });
})();

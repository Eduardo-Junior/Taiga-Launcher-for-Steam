/* Taiga Launcher, host do NativeGameLink dentro da Steam (contexto SharedJSContext).
 * Faz o papel do Millennium para o frontend do NativeGameLink for Steam (MIT): oferece a mesma API
 * "@steambrew/client" (módulos webpack da Steam, findSP, ganchos de janela, callable) e liga as chamadas
 * ao backend do Taiga Launcher por um binding do DevTools (Runtime.addBinding), sem porta, CORS ou token.
 * Implementação própria do Taiga Launcher; a interface segue o que o NativeGameLink espera. */
(function () {
 'use strict';
 if (window.__TAIGA_NGL_HOST__ && window.__TAIGA_NGL_HOST__.version >= 2) return;
 const pending = new Map();
 let nextId = 1;
 const bridgeReady = () => typeof window.__taiga_ffi__ === 'function';
 window.__taiga_ffi_resolve__ = function (id, ok, payload) {
  const p = pending.get(id); if (!p) return; pending.delete(id); clearTimeout(p.timer);
  ok ? p.resolve(payload) : p.reject(new Error(String(payload || 'Taiga Launcher backend error')));
 };
 function waitBridge(timeout) {
  if (bridgeReady()) return Promise.resolve();
  return new Promise((resolve, reject) => { const start = Date.now(); const tick = () => { if (bridgeReady()) resolve(); else if (Date.now() - start > timeout) reject(new Error('Taiga Launcher bridge unavailable')); else setTimeout(tick, 100); }; tick(); });
 }
 // Igual ao Millennium: a promessa resolve com o texto JSON da resposta do backend.
 function callServer(method, kwargs) {
  return waitBridge(15000).then(() => new Promise((resolve, reject) => {
   const id = nextId++;
   const timer = setTimeout(() => { if (pending.delete(id)) reject(new Error('Taiga Launcher backend timeout: ' + method)); }, 90000);
   pending.set(id, {resolve, reject, timer});
   try { window.__taiga_ffi__(JSON.stringify({id, method: String(method), args: kwargs && typeof kwargs === 'object' ? kwargs : {}})); }
   catch (e) { pending.delete(id); clearTimeout(timer); reject(e); }
  }));
 }

 // ── módulos webpack da Steam ──
 const modules = new Map();
 let webpackReq = null, seenModules = -1;
 // Normalmente "webpackChunksteamui"; o nome pode mudar entre versões da Steam.
 function webpackChunk() {
  const ok = c => c && typeof c.push === 'function' && Array.isArray(c);
  if (ok(window.webpackChunksteamui)) return window.webpackChunksteamui;
  for (const k of Object.keys(window)) { if (/^webpackChunk/.test(k)) { try { if (ok(window[k])) return window[k]; } catch (e) {} } }
  return null;
 }
 function loadModules() {
  // A Steam carrega partes da interface depois (ex.: Biblioteca): módulos novos entram na lista quando aparecem.
  try {
   if (!webpackReq) { const chunk = webpackChunk(); if (!chunk) return modules; chunk.push([[Symbol('taigasteam')], {}, r => { webpackReq = r; }]); }
   const all = webpackReq && webpackReq.m; if (!all) return modules;
   const ids = Object.keys(all); if (ids.length === seenModules) return modules; seenModules = ids.length;
   for (const id of ids) { if (modules.has(id)) continue; try { const m = webpackReq(id); if (m) modules.set(id, m); } catch (e) {} }
   classList = null;
  } catch (e) {}
  return modules;
 }
 const isCssHash = s => typeof s === 'string' && s.length >= 18 && s.length <= 30 && /^[A-Za-z0-9_-]+$/.test(s) && (/[0-9]/.test(s) || /[A-Z]{2}/.test(s) || (s.includes('-') && /[A-Z0-9]/.test(s)));
 const firstClass = v => { const parts = String(v).split(' '); return parts.length === 2 ? parts[0] : String(v); };
 function isClassModule(m) {
  if (!m || typeof m !== 'object' || m.__esModule) return false;
  const keys = Object.keys(m); if (!keys.length) return false; let hash = false;
  for (const k of keys) { const d = Object.getOwnPropertyDescriptor(m, k); if ((d && d.get) || typeof m[k] !== 'string') return false; if (isCssHash(firstClass(m[k]))) hash = true; }
  return hash;
 }
 const classCache = new WeakMap();
 const resolveModule = m => { if (!m || typeof m !== 'object') return m; if (classCache.has(m)) return classCache.get(m); const r = isClassModule(m) ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, firstClass(v)])) : m; classCache.set(m, r); return r; };
 function findModule(filter) { for (const m of loadModules().values()) { try { if (m.default && filter(m.default)) return resolveModule(m.default); if (filter(m)) return resolveModule(m); } catch (e) {} } }
 function findModuleDetailsByExport(filter, minExports) {
  for (const [id, m] of loadModules()) {
   if (!m) continue;
   for (const mod of [m.default, m]) {
    if (!mod || typeof mod !== 'object') continue;
    if (minExports && Object.keys(mod).length < minExports) continue;
    for (const name in mod) { let v; try { v = mod[name]; } catch (e) { continue; } if (!v) continue; try { if (filter(v, name)) return [mod, v, name, id]; } catch (e) {} }
   }
  }
  return [undefined, undefined, undefined, undefined];
 }
 let classList = null;
 function classModules() {
  if (classList) return classList; classList = [];
  for (const m of loadModules().values()) for (const mod of [m && m.default, m]) { try { if (!mod || typeof mod !== 'object') continue; const keys = Object.keys(mod); if (keys.length === 1 && mod.version) continue; if (keys.length > 1000 && mod.AboutSettings) continue; if (isClassModule(mod)) classList.push(resolveModule(mod)); } catch (e) {} }
  return classList;
 }
 function findSP() {
  if (document.title === 'SP') return window;
  try {
   const nav = window.GamepadNavTree && window.GamepadNavTree.m_context && window.GamepadNavTree.m_context.m_controller || window.FocusNavController;
   const ctx = nav && (nav.m_ActiveContext || nav.m_LastActiveContext); const trees = ctx && ctx.m_rgGamepadNavigationTrees;
   const root = trees && trees.find(x => x.m_ID === 'root_1_'); if (root) return root.Root.Element.ownerDocument.defaultView;
  } catch (e) {}
  try { const p = window.g_PopupManager && window.g_PopupManager.GetExistingPopup && (window.g_PopupManager.GetExistingPopup('SP Desktop_uid0') || window.g_PopupManager.GetExistingPopup('SP BPM_uid0')); if (p && p.m_popup) return p.m_popup; } catch (e) {}
  return undefined;
 }
 const GamepadButton = {};
 ['INVALID', 'OK', 'CANCEL', 'SECONDARY', 'OPTIONS', 'BUMPER_LEFT', 'BUMPER_RIGHT', 'TRIGGER_LEFT', 'TRIGGER_RIGHT', 'DIR_UP', 'DIR_DOWN', 'DIR_LEFT', 'DIR_RIGHT', 'SELECT', 'START', 'LSTICK_CLICK', 'RSTICK_CLICK', 'LSTICK_TOUCH', 'RSTICK_TOUCH', 'LPAD_TOUCH', 'LPAD_CLICK', 'RPAD_TOUCH', 'RPAD_CLICK', 'REAR_LEFT_UPPER', 'REAR_LEFT_LOWER', 'REAR_RIGHT_UPPER', 'REAR_RIGHT_LOWER', 'STEAM_GUIDE', 'STEAM_QUICK_MENU'].forEach((n, i) => { GamepadButton[n] = i; GamepadButton[i] = n; });
 let icons = null;
 const IconsModule = new Proxy({}, {get(_, key) {
  if (!icons) { try { icons = findModuleDetailsByExport(e => /Spinner\)}\)?,.\.createElement\("path",\{d:"M18 /.test(String(e && e.toString && e.toString())) || /Spinner\)[\s\S]*\.jsxs?\)\("path",\{d:"M18 /.test(String(e && e.toString && e.toString())))[0] || {}; } catch (e) { icons = {}; } }
  return icons[key] || (() => null);
 }});
 const Millennium = {
  callServerMethod: (_plugin, method, kwargs) => callServer(method, kwargs),
  findElement: (doc, selector, timeout) => new Promise((resolve, reject) => {
   const found = doc.querySelectorAll(selector); if (found.length) return resolve(found);
   const obs = new MutationObserver(() => { const m = doc.querySelectorAll(selector); if (m.length) { obs.disconnect(); if (timer) clearTimeout(timer); resolve(m); } });
   obs.observe(doc.body, {childList: true, subtree: true});
   const timer = timeout && setTimeout(() => { obs.disconnect(); reject(); }, timeout);
  }),
  exposeObj: (exportsOrObj, obj) => obj !== undefined ? Object.assign(exportsOrObj, obj) : exportsOrObj,
  AddWindowCreateHook: cb => { const pm = window.g_PopupManager; if (!pm) return; try { Array.from(pm.GetPopups()).forEach(cb); } catch (e) {} try { pm.AddPopupCreatedCallback(cb); } catch (e) {} },
 };
 function callable(a, b) {
  const route = b !== undefined ? b : a;
  return (...args) => callServer(route, args[0]);
 }
 const api = {
  Millennium, callable, definePlugin: fn => (...args) => fn(...args), findSP, GamepadButton, IconsModule,
  findModule, findModuleDetailsByExport, findModuleByExport: (f, n) => findModuleDetailsByExport(f, n)[0], findModuleExport: (f, n) => findModuleDetailsByExport(f, n)[1],
  findModuleChild: f => { for (const m of loadModules().values()) for (const mod of [m.default, m]) { try { const r = f(mod); if (r) return r; } catch (e) {} } },
  findAllModules: f => { const out = []; for (const m of loadModules().values()) { try { if (m.default && f(m.default)) out.push(resolveModule(m.default)); if (f(m)) out.push(resolveModule(m)); } catch (e) {} } return out; },
  findClassModule: f => classModules().find(m => { try { return f(m); } catch (e) { return false; } }),
  findClass: name => { const m = classModules().find(x => x && x[name]); return m && m[name]; },
  pluginSelf: {},
 };
 Object.defineProperty(api, 'modules', {get: loadModules, enumerable: true});
 // API própria, separada da do Millennium caso ele também esteja instalado.
 window.__TAIGA_MILLENNIUM_API__ = api;
 window.__TAIGA_NGL_HOST__ = {version: 2, call: callServer, modules: loadModules, webpackChunk};
})();

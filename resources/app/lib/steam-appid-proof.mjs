// Descobre o AppID da Steam de um jogo de PC com a prova mais forte disponível, nesta ordem:
//  1. Arquivos dentro da pasta do jogo que guardam o AppID (steam_appid.txt ao lado da steam_api.dll, pasta
//     steam_settings, .ini dos emuladores de Steam, appmanifest_<id>.acf). Procura em subpastas também: em jogos
//     Unity e Unreal a steam_api fica em <Jogo>_Data/Plugins/x86_64 ou Engine/Binaries/ThirdParty, não na raiz.
//  2. Verificação técnica de candidatos encontrados pelo nome: a ficha pública da Steam (PICS, pelo api.steamcmd.net)
//     diz qual .exe o jogo abre e o nome da pasta de instalação; se batem com os do jogo, é ele.
// O nome do produto gravado pelo motor do jogo (Unity app.info) entra como nome oficial para a busca por nome.
import fs from 'node:fs';
import path from 'node:path';

const MAX_ENTRIES = 8000;
const SKIP_DIRS = /^(?:\.git|node_modules|__pycache__|movies?|videos?|cinematics|music|sound|sounds|audio|shadercache|crashreports?|logs?|screenshots|redist|_commonredist|directx|dotnet|vcredist|support)$/i;
const INI_FILES = new Set(['steam_emu.ini', 'coldclientloader.ini', 'cream_api.ini', 'onlinefix.ini', 'onlinefix64.ini', 'ali213.ini', 'smartsteamemu.ini', 'steam_api.ini', 'steam_api64.ini', 'codex.ini', 'rune.ini', 'cpy.ini', 'tenoke.ini', 'unsteam.ini', 'valve.ini', 'hlm.ini', 'ds.ini', 'steamconfig.ini', 'configs.app.ini', 'configs.main.ini', 'empress.ini', 'goldberg.ini']);
const STEAM_DLL = /^steam_api(?:64)?\.dll$/i;

export function appIdFromText(text, file = '') {
 const s = String(text || '').replace(/^﻿/, '');
 if (/steam_appid\.txt$/i.test(file)) { const t = s.trim(); return /^[1-9]\d{0,9}$/.test(t) ? Number(t) : null; }
 // AppId=, RealAppId=, App_ID=, appid = (CreamAPI), "AppID" "123" (vdf), [TENOKE] id = 123.
 const m = s.match(/^\s*"?(?:Real)?App[_ ]?I[Dd]"?\s*(?:=|\s)\s*"?([1-9]\d{0,9})"?\s*$/mi)
  || (/tenoke/i.test(file) && s.match(/^\s*id\s*=\s*"?([1-9]\d{0,9})"?\s*$/mi));
 return m ? Number(m[1]) : null;
}

const readSmall = (file, max = 64 * 1024) => { try { const st = fs.statSync(file); if (!st.isFile() || st.size > max) return ''; return fs.readFileSync(file, 'utf8'); } catch { return ''; } };

// Procura o AppID nos arquivos da pasta do jogo (até 6 níveis). Quando há mais de um AppID, vale o que está ao lado
// da steam_api.dll (é o que o jogo de fato usa); depois, o mais repetido. 480 (Spacewar, usado por cracks) é ignorado.
// Pastas genéricas (Downloads, Área de Trabalho, raiz do disco, pasta com vários jogos) não são a pasta de um jogo.
export const GENERIC_FOLDER = /^(?:downloads?|desktop|documents|documentos|[áa]rea de trabalho|games|jogos|program files(?: \(x86\))?|steamlibrary|steamapps|common|users?|usu[áa]rios|public|onedrive|epic games|gog games|xboxgames)$/i;
export function isGameFolder(root) { if (!root) return false; const r = path.resolve(root), base = path.basename(r); return !!base && r !== path.parse(r).root && !GENERIC_FOLDER.test(base); }
export function appIdFromFolder(root, {maxDepth = 6} = {}) {
 if (!isGameFolder(root)) return null;
 let entries = 0;
 const found = [];
 const queue = [[path.resolve(root), 0]];
 while (queue.length && entries < MAX_ENTRIES) {
  const [dir, depth] = queue.shift();
  let list; try { list = fs.readdirSync(dir, {withFileTypes: true}); } catch { continue; }
  entries += list.length;
  const nearDll = list.some(e => e.isFile() && STEAM_DLL.test(e.name));
  for (const e of list) {
   const lower = e.name.toLowerCase(), full = path.join(dir, e.name);
   if (e.isDirectory()) {
    if (lower === 'steam_settings') { const id = appIdFromText(readSmall(path.join(full, 'steam_appid.txt')), 'steam_appid.txt') || appIdFromText(readSmall(path.join(full, 'configs.app.ini')), 'configs.app.ini') || appIdFromText(readSmall(path.join(full, 'configs.main.ini')), 'configs.main.ini'); if (id && id !== 480) found.push({appId: id, source: path.relative(root, path.join(full, 'steam_appid.txt')), nearDll, depth}); continue; }
    if (depth < maxDepth && !e.isSymbolicLink() && !SKIP_DIRS.test(e.name)) queue.push([full, depth + 1]);
    continue;
   }
   if (!e.isFile()) continue;
   let id = null;
   if (lower === 'steam_appid.txt') id = appIdFromText(readSmall(full, 64), 'steam_appid.txt');
   else if (INI_FILES.has(lower)) id = appIdFromText(readSmall(full), lower);
   else { const acf = lower.match(/^appmanifest_([1-9]\d{0,9})\.acf$/); if (acf) id = Number(acf[1]); }
   if (id && id !== 480) found.push({appId: id, source: path.relative(root, full) || e.name, nearDll, depth});
  }
 }
 if (!found.length) return null;
 const count = new Map(); for (const f of found) count.set(f.appId, (count.get(f.appId) || 0) + 1);
 found.sort((a, b) => Number(b.nearDll) - Number(a.nearDll) || count.get(b.appId) - count.get(a.appId) || a.depth - b.depth);
 // AppIDs diferentes sem nenhum ao lado da steam_api.dll: não dá para saber qual é o do jogo.
 if (count.size > 1 && !found[0].nearDll) return null;
 return {appId: found[0].appId, source: found[0].source, conflicting: count.size > 1};
}

// Nome do produto gravado pelo Unity (<Jogo>_Data/app.info: empresa na 1ª linha, produto na 2ª).
export function engineProductName(root) {
 if (!root) return null;
 let list; try { list = fs.readdirSync(root, {withFileTypes: true}); } catch { return null; }
 for (const e of list) {
  if (!e.isDirectory() || !/_Data$/i.test(e.name)) continue;
  const lines = readSmall(path.join(root, e.name, 'app.info'), 4096).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length >= 2 && lines[1].length > 1 && lines[1].length < 120) return {company: lines[0], product: lines[1], source: e.name + '/app.info'};
 }
 return null;
}

// .exe da pasta do jogo (raiz e um nível abaixo), para comparar com o que a Steam abre.
export function folderExecutables(root, exePath = '') {
 const out = new Set();
 if (exePath) out.add(path.basename(exePath).toLowerCase());
 const scan = (dir, depth) => { let list; try { list = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; } for (const e of list.slice(0, 400)) { if (e.isFile() && /\.exe$/i.test(e.name) && !/^(?:unins\d*|uninstall|setup|vc_?redist.*|dxsetup|crashreport.*|ue4prereqsetup.*|unitycrashhandler(?:32|64)?|launcher)\.exe$/i.test(e.name)) out.add(e.name.toLowerCase()); else if (depth < 1 && e.isDirectory() && !SKIP_DIRS.test(e.name)) scan(path.join(dir, e.name), depth + 1); } };
 if (root) scan(root, 0);
 return [...out];
}

const key = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

// Ficha pública da Steam (PICS) de um AppID: tipo, nome, pasta de instalação e .exe que o jogo abre.
export async function steamAppInfo(appId, request) {
 const r = await request('https://api.steamcmd.net/v1/info/' + Number(appId));
 const d = r?.data?.[String(appId)]; if (!d) return null;
 const launch = Object.values(d.config?.launch || {}).filter(l => !l?.config?.oslist || /windows/i.test(String(l.config.oslist)));
 return {appId: Number(appId), type: String(d.common?.type || '').toLowerCase(), name: String(d.common?.name || ''), installdir: String(d.config?.installdir || ''), executables: [...new Set(launch.map(l => path.win32.basename(String(l.executable || '')).toLowerCase()).filter(x => /\.exe$/.test(x)))]};
}

// O candidato é este jogo? Prova técnica: o .exe que a Steam abre existe na pasta do jogo, ou a pasta de instalação
// da Steam tem o mesmo nome da pasta do jogo.
export function verifyByFiles(info, {exes = [], folder = ''} = {}) {
 if (!info) return null;
 if (info.type && !['game', 'application', 'demo'].includes(info.type)) return null;
 const exe = info.executables.find(x => exes.includes(x) && !/^(?:launcher|start|game|play)\.exe$/.test(x));
 if (exe) return {by: 'exe', detail: exe};
 if (info.installdir && folder && key(info.installdir) === key(folder) && key(folder).length >= 4) return {by: 'installdir', detail: info.installdir};
 return null;
}

// Verifica os candidatos pela ficha da Steam. Só liga quando exatamente um deles bate.
export async function verifyCandidates(candidates, {exes, folder, request, max = 5}) {
 const hits = [];
 for (const c of (candidates || []).filter(c => Number(c.appId) > 0).slice(0, max)) {
  let info = null; try { info = await steamAppInfo(c.appId, request); } catch { continue; }
  const v = verifyByFiles(info, {exes, folder}); if (v) hits.push({appId: Number(c.appId), name: info.name || c.title, ...v});
 }
 const ids = [...new Set(hits.map(h => h.appId))];
 return ids.length === 1 ? hits[0] : null;
}

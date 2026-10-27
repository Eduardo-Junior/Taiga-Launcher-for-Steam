// Jogos instalados por outras lojas (inspirado nos importadores do BoilR, MIT/Apache).
// Somente leitura dos registros locais de cada loja: nada é instalado, alterado ou baixado.
// Epic Games, GOG (Galaxy e instaladores offline), Ubisoft Connect, itch.io e Amazon Games.
import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {scanXbox,scanRiot,scanHeroic,scanInstalledGames} from './stores-more.mjs';
import {scanLegendary} from './legendary.mjs';
// Jogos da Epic instalados pelo Taiga Launcher (Legendary): abrem pelo próprio Legendary.
let legendaryExe = '';
export const setLegendaryExe = exe => { legendaryExe = String(exe || ''); };
import {windowsDrives} from './discover.mjs';
import {executableTitle} from './executable-title.mjs';

const run = promisify(execFile);
const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const readJSON = f => { try { if (fs.statSync(f).size > 8 * 1024 * 1024) return null; return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } };
const winPath = p => String(p || '').replace(/\//g, path.sep);
export const explorer = (env = process.env) => path.join(env.SystemRoot || env.windir || 'C:\\Windows', 'explorer.exe');

// --- Epic Games: manifestos .item em ProgramData ---
export function scanEpic(env = process.env) {
 const dir = path.join(env.PROGRAMDATA || env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
 const out = [];
 let names = [];
 try { names = fs.readdirSync(dir).filter(n => n.toLowerCase().endsWith('.item')); } catch { names = []; }
 for (const name of names) {
  const m = readJSON(path.join(dir, name));
  if (!m || m.bIsIncompleteInstall || !m.DisplayName || !m.InstallLocation || !m.LaunchExecutable) continue;
  if (m.MainGameAppName && m.AppName && m.MainGameAppName !== m.AppName) continue; // DLC
  if (/^UE_\d/.test(m.AppName || '')) continue; // Unreal Engine
  const exe = path.join(winPath(m.InstallLocation), ...String(m.LaunchExecutable).split(/[\\/]/).filter(p => p && p !== '.'));
  const url = `com.epicgames.launcher://apps/${m.CatalogNamespace}%3A${m.CatalogItemId}%3A${m.AppName}?action=launch&silent=true`;
  const needsLauncher = !!(m.bIsManaged || m.ExpectingDLCInstalled && Object.keys(m.ExpectingDLCInstalled).length);
  out.push({store: 'epic', storeName: 'Epic Games', id: m.CatalogItemId || m.AppName, namespace: m.CatalogNamespace || '', appName: m.AppName || '', title: m.DisplayName, path: exe, root: winPath(m.InstallLocation), url, needsLauncher});
 }

 // Novo Epic Games Launcher (EGL v2): instalações em %LOCALAPPDATA%\com.epicgames.eglv2\installations.jsonl, uma por linha.
 const v2 = path.join(env.LOCALAPPDATA || path.join(env.USERPROFILE || '', 'AppData', 'Local'), 'com.epicgames.eglv2', 'installations.jsonl');
 let text = ''; try { if (fs.statSync(v2).size < 8 * 1024 * 1024) text = fs.readFileSync(v2, 'utf8'); } catch {}
 for (const line of text.split(/\r?\n/)) {
  let m = null; try { m = JSON.parse(line.trim().replace(/^\uFEFF/, '')); } catch { continue; }
  const dir = m?.dir || m?.installDir || m?.installLocation, launch = m?.launchExecutable || m?.launchExe;
  if (!m || m.complete === false || !dir || !launch || (m.platform && !/windows/i.test(m.platform))) continue;
  const root = winPath(dir), exe = path.join(root, ...String(launch).split(/[\\/]/).filter(p => p && p !== '.'));
  if (out.some(o => o.root.toLowerCase() === root.toLowerCase())) continue;
  let title = m.displayName || m.title || ''; if (!title) { try { title = executableTitle(exe) || ''; } catch {} }
  if (!title || /launcher|bootstrap/i.test(title)) title = (root.split(/[\\/]/).filter(Boolean).pop() || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').trim();
  const app = m.artifactId || m.appName || '', item = m.itemId || m.catalogItemId || '';
  const url = m.namespace && item && app ? `com.epicgames.launcher://apps/${m.namespace}%3A${item}%3A${app}?action=launch&silent=true` : '';
  out.push({store: 'epic', storeName: 'Epic Games', id: item || app || root, namespace: m.namespace || '', appName: app, title, path: exe, root, url, needsLauncher: false, egl2: true});
 }
 return out;
}
// --- GOG: arquivos goggame-*.info nas pastas de instalação do Galaxy ---
function gogInfo(folder) {
 const out = [];
 for (const base of [path.join(folder, 'game'), folder]) {
  let names = [];
  try { names = fs.readdirSync(base).filter(n => /^goggame-\d+\.info$/i.test(n)); } catch { continue; }
  for (const n of names) {
   const info = readJSON(path.join(base, n));
   if (!info?.name) continue;
   const task = (info.playTasks || []).find(t => t.isPrimary && t.type === 'FileTask' && (!t.category || ['game', 'launcher'].includes(t.category))) || (info.playTasks || []).find(t => t.type === 'FileTask' && t.path);
   if (!task?.path) continue;
   out.push({store: 'gog', storeName: 'GOG', id: String(info.gameId || ''), title: info.name, path: path.join(base, winPath(task.path)), root: base, args: task.arguments || '', workingDir: task.workingDir ? path.join(base, winPath(task.workingDir)) : base, needsLauncher: false});
  }
  if (out.length) break;
 }
 return out;
}
export function scanGOG(env = process.env, extraFolders = []) {
 const galaxy = path.join(env.PROGRAMDATA || env.ProgramData || 'C:\\ProgramData', 'GOG.com', 'Galaxy', 'config.json');
 const cfg = readJSON(galaxy) || {};
 const libraries = [...(Array.isArray(cfg.installationPaths) && cfg.installationPaths.length ? cfg.installationPaths : cfg.libraryPath ? [cfg.libraryPath] : []), ...extraFolders];
 const out = [];
 for (const lib of libraries) {
  let entries = [];
  try { entries = fs.readdirSync(lib, {withFileTypes: true}).filter(e => e.isDirectory()).slice(0, 2000); } catch { continue; }
  for (const e of entries) out.push(...gogInfo(path.join(lib, e.name)));
 }
 return out;
}
// Registro do Windows (reg.exe, somente consulta).
export async function regQuery(key) {
 if (process.platform !== 'win32') return [];
 try {
  const {stdout} = await run('reg.exe', ['query', key, '/s'], {windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 15000});
  const out = []; let current = null;
  for (const line of stdout.split(/\r?\n/)) {
   if (/^HKEY_/.test(line)) { current = {key: line.trim(), values: {}}; out.push(current); continue; }
   const m = line.match(/^\s{4}(.+?)\s{4}(REG_\w+)\s{4}(.*)$/);
   if (m && current) current.values[m[1]] = m[3];
  }
  return out;
 } catch { return []; }
}
export async function scanGOGRegistry() {
 const out = [];
 for (const entry of await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games')) {
  const v = entry.values;
  if (!v.gameName || !v.exe || !isFile(v.exe)) continue;
  out.push({store: 'gog', storeName: 'GOG', id: v.gameID || path.basename(entry.key), title: v.gameName, path: v.exe, root: v.path || path.dirname(v.exe), args: v.launchParam || '', workingDir: v.workingDir || v.path || path.dirname(v.exe), needsLauncher: false});
 }
 return out;
}
// --- Ubisoft Connect: instalações registradas e nomes da desinstalação ---
export async function scanUbisoft() {
 if (process.platform !== 'win32') return [];
 const launcher = (await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher'))[0]?.values?.InstallDir;
 const installs = (await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs')).filter(e => e.values.InstallDir && isDir(e.values.InstallDir));
 const uninstall = await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
 const out = [];
 for (const install of installs) {
  const id = path.basename(install.key), info = uninstall.find(e => e.key.endsWith('Uplay Install ' + id))?.values || {};
  const icon = String(info.DisplayIcon || '').replace(/^"|"$/g, '').replace(/,\d+$/, '');
  if (!info.DisplayName || !isFile(icon) || !/\.exe$/i.test(icon)) continue;
  out.push({store: 'ubisoft', storeName: 'Ubisoft Connect', id, title: info.DisplayName, path: icon, root: install.values.InstallDir, url: `uplay://launch/${id}/0`, needsLauncher: true, launcherExe: launcher ? path.join(launcher, 'upc.exe') : null});
 }
 return out;
}
// --- itch.io e Amazon Games: bancos SQLite locais (node:sqlite, somente leitura) ---
async function openSqlite(file) {
 if (!isFile(file)) return null;
 try { const {DatabaseSync} = await import('node:sqlite'); return new DatabaseSync(file, {readOnly: true}); } catch { return null; }
}
export async function scanItch(env = process.env) {
 const db = await openSqlite(path.join(env.APPDATA || '', 'itch', 'db', 'butler.db'));
 if (!db) return [];
 const out = [];
 try {
  const rows = db.prepare('SELECT caves.id AS id, caves.verdict AS verdict, caves.install_folder_name AS folder, games.title AS title, install_locations.path AS base FROM caves JOIN games ON games.id = caves.game_id LEFT JOIN install_locations ON install_locations.id = caves.install_location_id').all();
  for (const r of rows) {
   let verdict = null; try { verdict = JSON.parse(r.verdict || 'null'); } catch {}
   const base = verdict?.basePath || (r.base && r.folder ? path.join(r.base, r.folder) : ''), cand = (verdict?.candidates || []).find(c => /\.exe$/i.test(c.path || '') && (!c.flavor || c.flavor === 'windows')) ;
   if (!base || !cand) continue;
   const exe = path.join(base, winPath(cand.path));
   if (isFile(exe)) out.push({store: 'itch', storeName: 'itch.io', id: String(r.id), title: r.title, path: exe, root: base, needsLauncher: false});
  }
 } catch {} finally { try { db.close(); } catch {} }
 return out;
}
export async function scanAmazon(env = process.env) {
 const db = await openSqlite(path.join(env.LOCALAPPDATA || '', 'Amazon Games', 'Data', 'Games', 'Sql', 'GameInstallInfo.sqlite'));
 if (!db) return [];
 const out = [];
 try {
  for (const r of db.prepare('SELECT Id, ProductTitle, InstallDirectory, Installed FROM DbSet').all()) {
   if (!r.Installed || !r.InstallDirectory || !isDir(r.InstallDirectory)) continue;
   const fuel = readJSON(path.join(r.InstallDirectory, 'fuel.json')), cmd = fuel?.Main?.Command;
   const exe = cmd ? path.join(r.InstallDirectory, winPath(cmd)) : '';
   if (!isFile(exe)) continue;
   out.push({store: 'amazon', storeName: 'Amazon Games', id: r.Id, title: r.ProductTitle, path: exe, root: r.InstallDirectory, url: `amazon-games://play/${r.Id}`, needsLauncher: true});
  }
 } catch {} finally { try { db.close(); } catch {} }
 return out;
}
// Xbox / Microsoft Store pelo registro de pacotes do Windows (o mesmo caminho do Playnite): não depende de ler a pasta
// do jogo, que o Windows protege. Só entram pacotes da loja com MicrosoftGame.config (jogos GDK) ou instalados numa
// pasta de jogos do Xbox. O jogo abre pelo próprio Xbox: shell:AppsFolder\<família>!<app>.
const XBOX_PS = "$ErrorActionPreference='SilentlyContinue';[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false);$o=@();foreach($p in Get-AppxPackage -PackageTypeFilter Main){if($p.IsFramework -or $p.SignatureKind -ne 'Store' -or !$p.InstallLocation){continue};$l=$p.InstallLocation;$g=(Test-Path -LiteralPath (Join-Path $l 'MicrosoftGame.config')) -or ($l -match '\\\\(XboxGames|ModifiableWindowsApps)\\\\');if(!$g){continue};$m=$null;try{$m=Get-AppxPackageManifest $p}catch{};if(!$m){continue};$t=[string]$m.Package.Properties.DisplayName;foreach($a in @($m.Package.Applications.Application)){if(!$a.Id){continue};$o+=[pscustomobject]@{name=$p.Name;pfn=$p.PackageFamilyName;loc=$l;id=[string]$a.Id;exe=[string]$a.Executable;title=$t}}};ConvertTo-Json -InputObject @($o) -Compress -Depth 3";
export function xboxPackageItems(rows) {
 const out = [];
 for (const r of Array.isArray(rows) ? rows : []) {
  if (!r || !r.pfn || !r.id || !r.loc) continue;
  const loc = String(r.loc), parts = loc.split(/[\\/]/).filter(Boolean), ci = parts.findIndex(x => /^content$/i.test(x));
  const folder = ci > 0 ? parts[ci - 1] : parts.at(-1) || '';
  let title = String(r.title || ''); if (!title || /^ms-resource:/i.test(title)) title = folder.replace(/_[\d.]+_x64__\w+$/i, '') || String(r.name);
  const exe = path.join(loc, ...String(r.exe || 'GameLaunchHelper.exe').split(/[\\/]/));
  out.push({store: 'xbox', storeName: 'Xbox', id: String(r.name), title, path: exe, root: loc, url: 'shell:AppsFolder\\' + r.pfn + '!' + r.id, needsLauncher: true});
 }
 return out;
}
async function scanXboxPackages() {
 const {stdout} = await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', XBOX_PS], {windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: 60000});
 const text = String(stdout || '').trim(); if (!text) return [];
 return xboxPackageItems(JSON.parse(text));
}
export async function scanStores({env = process.env, platform = process.platform} = {}) {
 const results = [], errors = [];
 const drives = platform === 'win32' ? windowsDrives() : [];
 const tasks = [['Epic Games', () => scanEpic(env)], ['GOG', () => scanGOG(env)], ['GOG', () => scanGOGRegistry()], ['Ubisoft Connect', () => scanUbisoft()], ['itch.io', () => scanItch(env)], ['Amazon Games', () => scanAmazon(env)],
  ['Epic Games', () => scanLegendary({env, exe: legendaryExe})], ['Xbox', () => scanXbox({drives})], ['Xbox', async () => { if (platform !== 'win32') return []; const have = new Set(results.filter(r => r.store === 'xbox').map(r => r.id.toLowerCase())); return (await scanXboxPackages()).filter(i => !have.has(i.id.toLowerCase())); }], ['Riot Games', () => scanRiot(env)], ['Heroic', () => scanHeroic(env)],
  // Por último: EA app, Rockstar, Battle.net e jogos instalados sem loja (só com prova de que é jogo).
  ['Windows', () => scanInstalledGames({regQuery, skipRoots: results.map(r => r.root).filter(Boolean)})]];
 for (const [name, fn] of tasks) { try { results.push(...await fn()); } catch (e) { errors.push({file: name, message: String(e.message || e).slice(0, 200)}); } }
 const seen = new Set();
 return {items: results.filter(r => isFile(r.path) && !seen.has(r.path.toLowerCase()) && seen.add(r.path.toLowerCase())), errors};
}

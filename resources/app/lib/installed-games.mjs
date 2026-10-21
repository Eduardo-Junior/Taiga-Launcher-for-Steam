// "Jogos instalados no PC": como o Playnite, parte da lista de programas instalados do Windows e das pastas de
// jogos mais comuns, e só sugere o que tem prova de ser jogo (motor Unity/Unreal/Godot…, Steamworks, EOS…).
// Nada entra sozinho: a pessoa confirma numa lista com caixinhas.
import fs from 'node:fs';
import path from 'node:path';
import {gameEvidence, scanInstalledGames} from './stores-more.mjs';
import {consoleTitleNear} from './console-port.mjs';

const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch { return false; } };
const list = d => { try { return fs.readdirSync(d, {withFileTypes: true}); } catch { return []; } };
const AUX = /^(?:unins\d*|uninstall.*|setup.*|install.*|update.*|patch.*|vc_?redist.*|dxsetup|dotnet.*|crash.*|unitycrashhandler.*|ue4prereq.*|easyanticheat.*|battleye.*|launcher_?helper.*|cefprocess.*|notification.*|report.*|7z.*|python.*|config.*|settings.*|helper.*|redist.*)\.exe$/i;
const STRONG = new Set(['unity', 'unreal', 'godot', 'gamemaker', 'renpy', 'rpgmaker', 'steamworks', 'eos']);

function mainExe(root) {
  const pick = dir => list(dir).filter(e => e.isFile() && /\.exe$/i.test(e.name) && !AUX.test(e.name)).map(e => path.join(dir, e.name));
  let exes = pick(root);
  if (!exes.length) for (const sub of ['bin', 'Bin', 'Binaries\\Win64', 'Binaries/Win64', 'x64', 'Game']) { const d = path.join(root, sub); if (isDir(d)) { exes = pick(d); if (exes.length) break; } }
  const size = f => { try { return fs.statSync(f).size; } catch { return 0; } };
  // Unreal: o .exe pequeno na raiz abre o "-Shipping" de dentro; vale o da raiz.
  return exes.sort((a, b) => size(b) - size(a))[0] || '';
}
function portAt(exe) {
  let info = null; try { info = consoleTitleNear(exe); } catch {}
  if (!info?.dump || !isDir(info.dump)) return null;
  return {title: info.title, path: exe, root: path.dirname(exe), evidence: ['console-port'], store: null, storeName: '', source: 'port', platform: info.platform, code: info.code, confidence: 'high'};
}
const confidence = (evidence, store) => store && store !== 'windows' ? 'high' : evidence.some(e => STRONG.has(e)) ? 'high' : evidence.length ? 'medium' : 'low';

// Subpastas de C:\Games, D:\Jogos, X:\SteamLibrary não (Steam já é da Steam) etc.
export function gameFolderRoots(drives = [], home = '') {
  const out = [];
  for (const d of drives) for (const n of ['Games', 'Jogos', 'Game', 'Jogos PC', 'PC Games', 'Games PC']) { const p = path.join(d, n); if (isDir(p)) out.push(p); }
  for (const n of ['Games', 'Jogos']) if (home) { const p = path.join(home, n); if (isDir(p)) out.push(p); }
  return out;
}

export async function findInstalledGames({regQuery = null, drives = [], home = '', known = [], max = 400} = {}) {
  const knownSet = new Set(known.map(p => String(p).toLowerCase())), out = [], seenRoot = new Set();
  const push = item => { const r = item.root.toLowerCase(), p = item.path.toLowerCase(); if (seenRoot.has(r) || knownSet.has(p)) return; seenRoot.add(r); out.push(item); };
  // 1) Programas instalados do Windows com prova de jogo.
  if (regQuery) { try { for (const g of await scanInstalledGames({regQuery, includeLoose: true})) push({title: g.title, path: g.path, root: g.root, evidence: g.evidence || [], store: g.store, storeName: g.storeName, source: 'windows', confidence: confidence(g.evidence || [], g.store)}); } catch {} }
  // 2) Pastas de jogos comuns: cada subpasta com prova vira um jogo.
  let scanned = 0;
  for (const base of gameFolderRoots(drives, home)) for (const e of list(base)) {
    if (!e.isDirectory() || ++scanned > max) continue;
    const root = path.join(base, e.name); if (seenRoot.has(root.toLowerCase())) continue;
    const evidence = gameEvidence(root, {maxDepth: 2});
    const exe = mainExe(root); if (!exe) continue;
    const port = portAt(exe);
    if (port) { push(port); continue; }
    if (!evidence.length) continue;
    push({title: e.name.replace(/[_.]+/g, ' ').trim(), path: exe, root, evidence, store: null, storeName: '', source: 'folder', confidence: confidence(evidence, null)});
  }
  // 3) Ports de jogos de console (SpartanPort e parecidos) em qualquer pasta de primeiro ou segundo nível dos discos:
  //    um .exe com o dump do console por perto (PARAM.SFO) é jogo com certeza, com o nome oficial do dump.
  const SKIP = /^(\$|windows$|program ?files|programdata$|users$|perflogs$|recovery$|system volume information$|msocache$|intel$|amd$|nvidia$|drivers$|steamlibrary$|xboxgames$|epic ?games$|gog ?games$)/i;
  let probed = 0;
  const probe = dir => { if (++probed > 600 || seenRoot.has(dir.toLowerCase())) return false; const exe = mainExe(dir); if (!exe) return false; const port = portAt(exe); if (port) { push(port); return true; } return false; };
  for (const d of drives) for (const e of list(d)) {
    if (!e.isDirectory() || SKIP.test(e.name)) continue;
    const top = path.join(d, e.name); if (probe(top)) continue;
    for (const sub of list(top).slice(0, 40)) if (sub.isDirectory() && !SKIP.test(sub.name)) probe(path.join(top, sub.name));
  }
  return out.filter(x => x.confidence !== 'low').sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1) || a.title.localeCompare(b.title));
}

// Pasta de atalhos: o jeito simples de trazer jogos de PC. O usuário junta os atalhos dos jogos (.lnk, .url ou o
// próprio .exe) numa pasta; cada atalho vira um jogo (com o nome do atalho) e vai para a Steam; apagar o atalho
// tira o jogo. Nada de varrer o PC atrás de executáveis.
import fs from 'node:fs';
import path from 'node:path';
import {auxiliaryExecutable} from './games.mjs';

// Leitura direta do formato Shell Link (.lnk, MS-SHLLINK), sem PowerShell.
export function parseLnk(buf) {
 if (!Buffer.isBuffer(buf) || buf.length < 76 || buf.readUInt32LE(0) !== 0x4c) throw Error('Atalho inválido.');
 const flags = buf.readUInt32LE(0x14), unicode = !!(flags & 0x80);
 let o = 76;
 if (flags & 0x01) o += 2 + buf.readUInt16LE(o);
 let target = '';
 if (flags & 0x02) {
  const start = o, size = buf.readUInt32LE(o), headerSize = buf.readUInt32LE(o + 4), infoFlags = buf.readUInt32LE(o + 8);
  const cstr = at => { let e = at; while (e < buf.length && buf[e]) e++; return buf.toString('latin1', at, e); };
  const wstr = at => { let e = at; while (e + 1 < buf.length && (buf[e] || buf[e + 1])) e += 2; return buf.toString('utf16le', at, e); };
  if (infoFlags & 1) {
   const base = headerSize >= 0x24 && buf.readUInt32LE(start + 28) ? wstr(start + buf.readUInt32LE(start + 28)) : cstr(start + buf.readUInt32LE(start + 16));
   const suffix = headerSize >= 0x24 && buf.readUInt32LE(start + 32) ? wstr(start + buf.readUInt32LE(start + 32)) : cstr(start + buf.readUInt32LE(start + 24));
   target = base + suffix;
  }
  o = start + size;
 }
 const strings = {};
 for (const [bit, key] of [[0x04, 'name'], [0x08, 'relativePath'], [0x10, 'workingDir'], [0x20, 'arguments'], [0x40, 'iconLocation']]) {
  if (!(flags & bit)) continue;
  const n = buf.readUInt16LE(o); o += 2;
  strings[key] = unicode ? buf.toString('utf16le', o, o + n * 2) : buf.toString('latin1', o, o + n); o += unicode ? n * 2 : n;
 }
 return {target, ...strings};
}
export function parseUrlFile(text) { const m = String(text || '').match(/^\s*URL\s*=\s*(.+?)\s*$/mi); return m ? m[1] : ''; }

// Atalhos sempre trazem caminhos do Windows; path.win32 mantém o resultado certo em qualquer sistema.
const dirOf = p => /^[a-z]:[\\/]|^\\\\/i.test(p) ? path.win32.dirname(p) : path.dirname(p);
const SHORTCUT = /\.(lnk|url|exe)$/i;
// Lista os atalhos da pasta (só o primeiro nível e uma subpasta, para organizar por loja se quiser).
export function listShortcuts(folder) {
 const out = [], errors = [];
 const walk = (dir, depth) => {
  let entries = []; try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch (e) { errors.push({file: dir, message: e.message}); return; }
  for (const d of entries) {
   const file = path.join(dir, d.name);
   if (d.isDirectory()) { if (depth < 1) walk(file, depth + 1); continue; }
   if (!SHORTCUT.test(d.name)) continue;
   // Na pasta principal todo arquivo vira jogo; numa subpasta (ex.: a pasta inteira de um jogo) os programas auxiliares
   // (desinstalador, relatório de erro, instalador) ficam de fora.
   if (depth > 0 && /\.exe$/i.test(d.name) && auxiliaryExecutable(d.name)) continue;
   const ext = path.extname(d.name).toLowerCase();
   // Pasta inteira de um jogo dentro da pasta de atalhos: o jogo leva o nome da pasta ("The Witcher 3", não "witcher3").
   const exes = depth > 0 && ext === '.exe' ? entries.filter(x => x.isFile() && /\.exe$/i.test(x.name) && !auxiliaryExecutable(x.name)) : [];
   const name = exes.length === 1 ? path.basename(dir).trim() : d.name.replace(SHORTCUT, '').trim();
   try {
    if (ext === '.exe') out.push({file, name, kind: 'exe', target: file, args: '', workingDir: path.dirname(file)});
    else if (ext === '.lnk') { const l = parseLnk(fs.readFileSync(file)); const target = l.target || (l.relativePath ? path.resolve(dir, l.relativePath) : ''); if (!/\.exe$/i.test(target)) throw Error('O atalho não aponta para um .exe.'); out.push({file, name, kind: 'lnk', target, args: l.arguments || '', workingDir: l.workingDir || dirOf(target)}); }
    else { const url = parseUrlFile(fs.readFileSync(file, 'utf8')); if (!url) throw Error('Atalho de internet sem endereço.'); if (/^steam:\/\//i.test(url)) continue; out.push({file, name, kind: 'url', url}); }
   } catch (e) { errors.push({file, message: e.message}); }
  }
 };
 walk(folder, 0);
 return {items: out, errors};
}
// Epic: com.epicgames.launcher://apps/<namespace>%3A<catalogItemId>%3A<appName>?action=launch
export function epicFromUrl(url) {
 const m = String(url || '').match(/^com\.epicgames\.launcher:\/\/apps\/([^?]+)/i); if (!m) return null;
 const parts = decodeURIComponent(m[1]).split(':'); return parts.length >= 3 ? {namespace: parts[0], catalogItemId: parts[1], appName: parts.slice(2).join(':')} : {appName: parts[0]};
}

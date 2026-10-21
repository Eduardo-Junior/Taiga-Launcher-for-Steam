// Leitura limitada de imagens de disco: ISO (2048), BIN/IMG cru (2352, Mode1/Mode2),
// CUE (primeira trilha de dados), CSO v1 e GDI (trilha 3 do Dreamcast).
// Nada é extraído para o disco; somente setores necessários são lidos.
import fs from 'node:fs';
import path from 'node:path';
import {reader as csoReader} from './psp.mjs';

const SYNC = Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00]);

export function parseCue(file) {
 const st = fs.statSync(file);
 if (st.size > 1024 * 1024) throw Error('CUE muito grande.');
 const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
 const tracks = [];
 let current = null;
 for (const line of text.split(/\r?\n/)) {
  const f = line.match(/^\s*FILE\s+(?:"([^"]+)"|(\S+))\s+(\w+)/i);
  if (f) { current = {file: path.resolve(path.dirname(file), f[1] || f[2]), tracks: []}; tracks.push(current); continue; }
  const t = line.match(/^\s*TRACK\s+(\d+)\s+(\S+)/i);
  if (t && current) current.tracks.push({number: Number(t[1]), mode: t[2].toUpperCase()});
 }
 return tracks;
}
export function parseGdi(file) {
 const st = fs.statSync(file);
 if (st.size > 64 * 1024) throw Error('GDI muito grande.');
 const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
 const out = [];
 for (const line of lines.slice(1)) {
  const m = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(?:"([^"]+)"|(\S+))\s+(\d+)/);
  if (m) out.push({number: Number(m[1]), lba: Number(m[2]), type: Number(m[3]), sectorSize: Number(m[4]), file: path.resolve(path.dirname(file), m[5] || m[6])});
 }
 return out;
}
// Abre a primeira trilha de dados e expõe leitura por endereço lógico de 2048 bytes.
export function openDisc(input) {
 let file = input, ext = path.extname(file).slice(1).toLowerCase(), lbaBase = 0;
 if (ext === 'm3u') {
  // Lista de discos: abre o primeiro disco listado.
  if (fs.statSync(file).size > 64 * 1024) throw Error('M3U muito grande.');
  const first = fs.readFileSync(file, 'utf8').split(/\r?\n/).map(l => l.trim()).find(l => l && !l.startsWith('#'));
  if (!first) throw Error('M3U vazio.');
  return openDisc(path.resolve(path.dirname(file), first));
 }
 if (ext === 'cue') {
  const entries = parseCue(file), data = entries.find(e => e.tracks.some(t => t.mode !== 'AUDIO')) || entries[0];
  if (!data) throw Error('CUE sem trilhas.');
  file = data.file; ext = path.extname(file).slice(1).toLowerCase();
 } else if (ext === 'gdi') {
  const track = parseGdi(file).find(t => t.number === 3) || parseGdi(file).find(t => t.type === 4);
  if (!track) throw Error('GDI sem trilha de dados.');
  file = track.file; lbaBase = track.lba; ext = path.extname(file).slice(1).toLowerCase();
 }
 if (ext === 'cso') { const r = csoReader(file); return {...r, file, sectorSize: 2048, header: 0, lbaBase}; }
 const fd = fs.openSync(file, 'r'), size = fs.fstatSync(fd).size;
 const raw = (at, n) => { if (at < 0 || n < 0 || at + n > size) throw Error('Imagem truncada'); const b = Buffer.alloc(n); if (fs.readSync(fd, b, 0, n, at) !== n) throw Error('Leitura incompleta'); return b; };
 let sectorSize = 2048, header = 0;
 try {
  const head = raw(0, Math.min(size, 16));
  if (head.length >= 16 && head.subarray(0, 12).equals(SYNC)) {
   sectorSize = 2352;
   header = head[15] === 2 ? 24 : 16;
  } else if (size % 2352 === 0 && size % 2048 !== 0) {
   sectorSize = 2352; header = 24;
  }
 } catch (e) { fs.closeSync(fd); throw e; }
 // Converte endereços lógicos (setores de 2048) para posições físicas.
 const read = (at, n) => {
  if (n > 64 * 1024 * 1024) throw Error('Leitura excessiva');
  if (sectorSize === 2048) return raw(at, n);
  const out = Buffer.alloc(n);
  let done = 0;
  while (done < n) {
   const sector = Math.floor((at + done) / 2048), offset = (at + done) % 2048, take = Math.min(2048 - offset, n - done);
   raw(sector * sectorSize + header + offset, take).copy(out, done);
   done += take;
  }
  return out;
 };
 return {read, close: () => fs.closeSync(fd), file, sectorSize, header, size, lbaBase};
}
// Procura um arquivo no ISO9660 sem diferenciar maiúsculas; retorna setor e tamanho.
export function findIsoEntry(disc, parts) {
 const base = (disc.lbaBase || 0) * 2048;
 const lba = n => n * 2048 - base;
 const pvd = disc.read(lba(16 + (disc.lbaBase || 0)), 2048);
 if (pvd.toString('ascii', 1, 6) !== 'CD001') return null;
 let rec = pvd.subarray(156, 190);
 for (const part of parts) {
  const extent = rec.readUInt32LE(2), size = rec.readUInt32LE(10);
  if (size > 8 * 1024 * 1024) return null;
  const dir = disc.read(lba(extent), size);
  let found = null;
  for (let i = 0; i < dir.length;) {
   const len = dir[i];
   if (!len) { i = (Math.floor(i / 2048) + 1) * 2048; continue; }
   if (len < 34 || i + len > dir.length) return null;
   const r = dir.subarray(i, i + len), name = r.toString('ascii', 33, 33 + r[32]).replace(/;\d+$/, '').replace(/\.$/, '');
   if (name.toUpperCase() === String(part).toUpperCase()) { found = r; break; }
   i += len;
  }
  if (!found) return null;
  rec = found;
 }
 return {sector: rec.readUInt32LE(2), size: rec.readUInt32LE(10), at: lba(rec.readUInt32LE(2))};
}
export function readIsoFile(disc, parts, max = 8 * 1024 * 1024) {
 const entry = findIsoEntry(disc, parts);
 if (!entry || entry.size > max) return null;
 return disc.read(entry.at, entry.size);
}
// SYSTEM.CNF de PS1/PS2: BOOT = cdrom:\SLUS_123.45;1 ou BOOT2 = cdrom0:\SLUS_123.45;1
export function systemCnf(disc) {
 const cnf = readIsoFile(disc, ['SYSTEM.CNF'], 64 * 1024);
 if (!cnf) return null;
 const text = cnf.toString('latin1');
 const boot2 = text.match(/BOOT2\s*=\s*cdrom0?:\\*([^;\r\n]+)/i), boot = text.match(/BOOT\s*=\s*cdrom:\\*([^;\r\n]+)/i);
 const m = boot2 || boot;
 if (!m) return null;
 const exe = m[1].trim().replace(/\//g, '\\');
 return {platform: boot2 ? 'ps2' : 'ps1', exe, serial: path.win32.basename(exe).replace(/[^A-Z0-9]/gi, '').toUpperCase()};
}
// Cabeçalhos de sistemas Sega em CD (primeiro setor de dados).
export function segaDiscHeader(disc) {
 const head = disc.read((disc.lbaBase ? 0 : 0), 512);
 const text = head.toString('latin1');
 if (text.startsWith('SEGA SEGASATURN')) return {platform: 'saturn', serial: text.slice(0x20, 0x2a).trim(), title: text.slice(0x60, 0xd0).replace(/\s+/g, ' ').trim()};
 if (/^SEGA(?:DISCSYSTEM|BOOTDISC|_CD_ROM)/.test(text)) return {platform: 'segacd', serial: text.slice(0x180, 0x18e).trim(), title: text.slice(0x150, 0x180).replace(/\s+/g, ' ').trim()};
 if (text.startsWith('SEGA SEGAKATANA')) return {platform: 'dreamcast', serial: text.slice(0x40, 0x4a).trim(), title: text.slice(0x80, 0x100).replace(/\s+/g, ' ').trim()};
 return null;
}
// Dreamcast: IP.BIN fica no início da trilha 3 (GDI) ou da trilha de dados (CDI não suportado).
export function dreamcastHeader(file) {
 let disc;
 try {
  disc = openDisc(file);
  const head = disc.read(0, 512).toString('latin1');
  if (!head.startsWith('SEGA SEGAKATANA')) return null;
  return {platform: 'dreamcast', serial: head.slice(0x40, 0x4a).trim(), title: head.slice(0x80, 0x100).replace(/\s+/g, ' ').trim()};
 } catch { return null; } finally { disc?.close(); }
}

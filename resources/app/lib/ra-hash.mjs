// Hashes de identificação compatíveis com o RetroAchievements (rcheevos).
// O hash identifica o dump exato; com ele, a correspondência com o conjunto de
// conquistas é feita sem depender do nome do arquivo e sem conta RA.
// Algoritmos reimplementados a partir da documentação pública "Game Identification"
// do RetroAchievements e do comportamento do rcheevos (MIT).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {openDisc, findIsoEntry} from './disc.mjs';
import {mainZipEntry, readZipEntry} from './zip.mjs';

const MAX = 64 * 1024 * 1024;
const md5 = (...parts) => { const h = crypto.createHash('md5'); for (const p of parts) h.update(p); return h.digest('hex'); };

function readWhole(file) {
 if (/\.zip$/i.test(file)) {
  const entry = mainZipEntry(file);
  if (!entry) throw Error('ZIP sem ROM.');
  return {bytes: readZipEntry(file, entry), inner: entry.name};
 }
 const st = fs.statSync(file);
 if (st.size > MAX) throw Error('Arquivo grande demais para o hash RA.');
 return {bytes: fs.readFileSync(file), inner: path.basename(file)};
}
const skip = (b, n) => b.subarray(n);

export const RA_BUFFER_HASHES = {
 whole: b => md5(b.subarray(0, MAX)),
 nes: b => md5((b.length > 16 && (b.toString('latin1', 0, 4) === 'NES\x1a' || b.toString('latin1', 0, 4) === 'FDS\x1a')) ? skip(b, 16) : b),
 fds: b => md5((b.length > 16 && (b.toString('latin1', 0, 4) === 'FDS\x1a' || b.toString('latin1', 0, 4) === 'NES\x1a')) ? skip(b, 16) : b),
 snes: b => md5(b.length % 0x2000 === 512 ? skip(b, 512) : b),
 pce: b => md5(b.length % 0x20000 === 512 ? skip(b, 512) : b),
 lynx: b => md5(b.length > 64 && b.toString('latin1', 0, 5) === 'LYNX\0' ? skip(b, 64) : b),
 atari7800: b => md5(b.length > 128 && b.toString('latin1', 1, 10) === 'ATARI7800' ? skip(b, 128) : b),
 n64: b => {
  let out = b;
  if (b[0] === 0x37) { out = Buffer.from(b); for (let i = 0; i + 1 < out.length; i += 2) { const t = out[i]; out[i] = out[i + 1]; out[i + 1] = t; } }
  else if (b[0] === 0x40) { out = Buffer.from(b); for (let i = 0; i + 3 < out.length; i += 4) { const a = out[i], c = out[i + 1]; out[i] = out[i + 3]; out[i + 1] = out[i + 2]; out[i + 2] = c; out[i + 3] = a; } }
  else if (![0x80, 0xe8, 0x22].includes(b[0])) throw Error('ROM de N64 não reconhecida.');
  return md5(out);
 },
 nds: b => {
  let offset = 0, header = b.subarray(0, 512);
  if (header[0] === 0x2e && header[1] === 0 && header[2] === 0 && header[3] === 0xea && header[0xb0] === 0x44 && header[0xb1] === 0x46 && header[0xb2] === 0x96 && header[0xb3] === 0) { offset = 512; header = b.subarray(512, 1024); }
  const u32 = at => header.readUInt32LE(at);
  const arm9 = u32(0x20), arm9Size = u32(0x2c), arm7 = u32(0x30), arm7Size = u32(0x3c), icon = u32(0x68);
  if (arm9Size + arm7Size > 16 * 1024 * 1024) throw Error('Não parece uma ROM de DS.');
  const slice = (at, n) => { const out = Buffer.alloc(n); b.copy(out, 0, Math.min(b.length, at + offset), Math.min(b.length, at + offset + n)); return out; };
  return md5(header.subarray(0, 0x160), slice(arm9, arm9Size), slice(arm7, arm7Size), slice(icon, 0xa00));
 },
};

// Lê um arquivo do disco a partir do setor, limitado a 64 MB (igual ao rcheevos).
function cdFile(disc, entry, name) {
 const size = Math.min(entry.size, MAX);
 const parts = [];
 if (name) parts.push(Buffer.from(name, 'latin1'));
 parts.push(disc.read(entry.at, size));
 return parts;
}
// Procura o executável de PS1/PS2 indicado pelo SYSTEM.CNF (mesma regra do rcheevos).
function playstationExecutable(disc, key, prefix) {
 const cnf = findIsoEntry(disc, ['SYSTEM.CNF']);
 if (!cnf) return null;
 const text = disc.read(cnf.at, Math.min(cnf.size, 2047)).toString('latin1');
 for (const line of text.split('\n')) {
  const at = line.indexOf(key);
  if (at < 0) continue;
  let rest = line.slice(at + key.length).replace(/^\s+/, '');
  if (!rest.startsWith('=')) continue;
  rest = rest.slice(1).replace(/^\s+/, '');
  if (rest.startsWith(prefix)) rest = rest.slice(prefix.length);
  rest = rest.replace(/^\\+/, '');
  const name = rest.match(/^[^\s;]*/)[0];
  const entry = findIsoEntry(disc, name.split('\\').filter(Boolean));
  return entry ? {name, entry} : null;
 }
 return null;
}
const DISC_HASHES = {
 psp: disc => {
  const sfo = findIsoEntry(disc, ['PSP_GAME', 'PARAM.SFO']), eboot = findIsoEntry(disc, ['PSP_GAME', 'SYSDIR', 'EBOOT.BIN']);
  if (!sfo || !eboot) throw Error('PSP_GAME incompleto.');
  return md5(...cdFile(disc, sfo), ...cdFile(disc, eboot));
 },
 ps1: disc => {
  let exe = playstationExecutable(disc, 'BOOT', 'cdrom:');
  if (!exe) { const e = findIsoEntry(disc, ['PSX.EXE']); if (e) exe = {name: 'PSX.EXE', entry: e}; }
  if (!exe) throw Error('Executável de PS1 não encontrado.');
  const first = disc.read(exe.entry.at, 2048);
  let size = exe.entry.size;
  if (first.toString('latin1', 0, 7) === 'PS-X EX') size = first.readUInt32LE(28) + 2048;
  return md5(...cdFile(disc, {...exe.entry, size}, exe.name));
 },
 ps2: disc => {
  const exe = playstationExecutable(disc, 'BOOT2', 'cdrom0:');
  if (!exe) throw Error('Executável de PS2 não encontrado.');
  return md5(...cdFile(disc, exe.entry, exe.name));
 },
 segacd: disc => {
  const head = disc.read(0, 512);
  if (!/^(?:SEGADISCSYSTEM {2}|SEGA SEGASATURN )/.test(head.toString('latin1', 0, 16))) throw Error('Não é um disco Sega CD/Saturn.');
  return md5(head);
 },
};
DISC_HASHES.saturn = DISC_HASHES.segacd;

// Calcula o hash RA de um arquivo para a plataforma (chave do catálogo). Retorna null se não aplicável.
export function raHash(file, platform) {
 const method = platform?.hash;
 if (!method) return null;
 if (method === 'arcade') {
  const name = path.basename(file, path.extname(file));
  return md5(Buffer.from(name, 'latin1'));
 }
 if (DISC_HASHES[method]) {
  const disc = openDisc(file);
  try { return DISC_HASHES[method](disc); } finally { disc.close(); }
 }
 const fn = RA_BUFFER_HASHES[method];
 if (!fn) return null;
 return fn(readWhole(file).bytes);
}

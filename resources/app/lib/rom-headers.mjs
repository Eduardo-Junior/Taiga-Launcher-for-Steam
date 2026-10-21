// Cabeçalhos internos de cartuchos: título e código do jogo gravados na ROM.
// Leitura limitada aos primeiros bytes; nada é executado.
import fs from 'node:fs';

const ascii = (b, from, to) => b.toString('latin1', from, to).replace(/\0.*$/s, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();

export function readHead(file, size = 0x10200) {
 const fd = fs.openSync(file, 'r');
 try { const st = fs.fstatSync(fd), n = Math.min(size, st.size), b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, 0); return b; }
 finally { fs.closeSync(fd); }
}
// Retorna {platform, title, serial} quando o cabeçalho é reconhecido com segurança.
export function cartridgeHeader(b, ext) {
 if (!b || b.length < 0x200) return null;
 // GBA: logotipo Nintendo a partir de 0x04 e byte fixo 0x96 em 0xB2.
 if (b.length >= 0xc0 && b[0xb2] === 0x96 && b[0x03] === 0xea) {
  const title = ascii(b, 0xa0, 0xac), code = ascii(b, 0xac, 0xb0);
  if (/^[A-Z0-9]{4}$/.test(code)) return {platform: 'gba', title, serial: code};
 }
 // NDS: código do jogo em 0x0C e CRC do logotipo (0xCF56) em 0x15C.
 if (b.length >= 0x160 && b.readUInt16LE(0x15c) === 0xcf56) {
  const title = ascii(b, 0, 12), code = ascii(b, 0x0c, 0x10);
  return {platform: 'nds', title, serial: code};
 }
 // Game Boy / Color: logotipo em 0x104 (CE ED 66 66) e flag CGB em 0x143.
 if (b.length >= 0x150 && b.readUInt32BE(0x104) === 0xceed6666) {
  const cgb = b[0x143] === 0x80 || b[0x143] === 0xc0;
  const title = ascii(b, 0x134, cgb ? 0x13f : 0x144);
  return {platform: b[0x143] === 0xc0 || (cgb && ext === 'gbc') ? 'gbc' : ext === 'gbc' ? 'gbc' : 'gb', title, serial: ''};
 }
 // N64: 0x80371240 (z64), 0x37804012 (v64), 0x40123780 (n64).
 const magic = b.readUInt32BE(0);
 if ([0x80371240, 0x37804012, 0x40123780].includes(magic)) {
  let h = b.subarray(0, 0x40);
  if (magic === 0x37804012) { h = Buffer.from(h); for (let i = 0; i < h.length; i += 2) { const t = h[i]; h[i] = h[i + 1]; h[i + 1] = t; } }
  if (magic === 0x40123780) { h = Buffer.from(h); for (let i = 0; i < h.length; i += 4) h.subarray(i, i + 4).reverse(); }
  return {platform: 'n64', title: ascii(h, 0x20, 0x34), serial: ascii(h, 0x3b, 0x3f)};
 }
 // Mega Drive/Genesis: "SEGA" em 0x100.
 if (b.length >= 0x200 && /^ ?SEGA/.test(b.toString('latin1', 0x100, 0x105))) {
  const sys = b.toString('latin1', 0x100, 0x110);
  const overseas = ascii(b, 0x150, 0x180), domestic = ascii(b, 0x120, 0x150), serial = ascii(b, 0x180, 0x18e);
  return {platform: /32X/.test(sys) ? 'sega32x' : 'genesis', title: overseas || domestic, serial};
 }
 // NES: cabeçalho iNES (sem título interno).
 if (b.toString('latin1', 0, 4) === 'NES\x1a') return {platform: 'nes', title: '', serial: ''};
 if (b.toString('latin1', 0, 4) === 'FDS\x1a') return {platform: 'fds', title: '', serial: ''};
 // Lynx e Atari 7800 têm cabeçalhos próprios.
 if (b.toString('latin1', 0, 4) === 'LYNX') return {platform: 'lynx', title: ascii(b, 0x0a, 0x2a), serial: ''};
 if (b.toString('latin1', 1, 10) === 'ATARI7800') return {platform: 'atari7800', title: ascii(b, 0x11, 0x31), serial: ''};
 // SNES: cabeçalho LoROM (0x7FC0) ou HiROM (0xFFC0), com ou sem cabeçalho de copiadora.
 if (['sfc', 'smc', 'swc', 'fig'].includes(ext)) {
  for (const base of [0x7fc0, 0xffc0, 0x81c0, 0x101c0]) {
   if (b.length < base + 0x30) continue;
   const checksum = b.readUInt16LE(base + 0x1e), complement = b.readUInt16LE(base + 0x1c);
   if ((checksum ^ complement) === 0xffff) return {platform: 'snes', title: ascii(b, base, base + 21), serial: ascii(b, base - 0x10 + 2, base - 0x10 + 6)};
  }
 }
 return null;
}
// PARAM.SFO de PS Vita e PS4 (pastas instaladas com sce_sys/param.sfo).
export function consoleFromSfo(meta) {
 const id = String(meta?.TITLE_ID || '').toUpperCase();
 if (/^(?:CUSA|PLAS)\d{5}$/.test(id)) return 'ps4';
 if (/^(?:PCS[A-Z]|NP[A-Z]{2})\d{5}$/.test(id)) return 'vita';
 if (/^(?:BL|BC|NP)[A-Z]{2}\d{5}$/.test(id)) return 'ps3';
 return null;
}

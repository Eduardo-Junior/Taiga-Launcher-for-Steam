// Lê o destino de um atalho do Windows (.lnk) sem depender do Windows: segue o formato MS-SHLLINK
// (cabeçalho → lista de IDs → LinkInfo com o caminho local). Devolve '' quando não encontra um caminho local.
import fs from 'node:fs';

export function lnkTarget(input) {
  const b = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
  if (b.length < 0x4C || b.readUInt32LE(0) !== 0x4C) return '';
  const flags = b.readUInt32LE(0x14);
  let pos = 0x4C;
  if (flags & 0x01) { if (pos + 2 > b.length) return ''; pos += 2 + b.readUInt16LE(pos); }
  if (!(flags & 0x02) || pos + 0x1C > b.length) return '';
  const start = pos, size = b.readUInt32LE(start), headerSize = b.readUInt32LE(start + 4), infoFlags = b.readUInt32LE(start + 8);
  if (!(infoFlags & 1) || start + size > b.length) return '';
  const ansi = off => { let end = off; while (end < b.length && b[end] !== 0) end++; return b.toString('latin1', off, end); };
  const wide = off => { let end = off; while (end + 1 < b.length && (b[end] || b[end + 1])) end += 2; return b.toString('utf16le', off, end); };
  let base = '', suffix = '';
  if (headerSize >= 0x24) {
    const uBase = b.readUInt32LE(start + 0x1C), uSuffix = b.readUInt32LE(start + 0x20);
    if (uBase) base = wide(start + uBase);
    if (uSuffix) suffix = wide(start + uSuffix);
  }
  if (!base) { base = ansi(start + b.readUInt32LE(start + 0x10)); suffix = ansi(start + b.readUInt32LE(start + 0x18)); }
  if (!base) return '';
  return suffix ? base.replace(/\\?$/, '\\') + suffix : base;
}

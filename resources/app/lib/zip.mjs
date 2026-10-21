// Leitura mínima de ZIP para ROMs compactadas (um arquivo principal).
// Usa o diretório central: CRC e tamanho vêm sem descompactar; o conteúdo só é
// descompactado quando necessário para o hash RetroAchievements (até 64 MB).
import fs from 'node:fs';
import {inflateRawSync} from 'node:zlib';

export function zipEntries(file) {
 const fd = fs.openSync(file, 'r');
 try {
  const size = fs.fstatSync(fd).size, tailSize = Math.min(size, 65557), tail = Buffer.alloc(tailSize);
  fs.readSync(fd, tail, 0, tailSize, size - tailSize);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw Error('ZIP inválido.');
  const count = tail.readUInt16LE(eocd + 10), dirSize = tail.readUInt32LE(eocd + 12), dirOffset = tail.readUInt32LE(eocd + 16);
  if (count > 4096 || dirSize > 8 * 1024 * 1024 || dirOffset + dirSize > size) throw Error('ZIP muito grande ou ZIP64 não suportado.');
  const dir = Buffer.alloc(dirSize);
  fs.readSync(fd, dir, 0, dirSize, dirOffset);
  const out = [];
  for (let i = 0, n = 0; n < count && i + 46 <= dir.length; n++) {
   if (dir.readUInt32LE(i) !== 0x02014b50) break;
   const method = dir.readUInt16LE(i + 10), crc = dir.readUInt32LE(i + 16), packed = dir.readUInt32LE(i + 20), unpacked = dir.readUInt32LE(i + 24);
   const nameLen = dir.readUInt16LE(i + 28), extraLen = dir.readUInt16LE(i + 30), commentLen = dir.readUInt16LE(i + 32), local = dir.readUInt32LE(i + 42);
   const name = dir.toString('utf8', i + 46, i + 46 + nameLen);
   if (!name.endsWith('/')) out.push({name, method, crc: crc.toString(16).padStart(8, '0').toUpperCase(), packed, unpacked, local});
   i += 46 + nameLen + extraLen + commentLen;
  }
  return out;
 } finally { fs.closeSync(fd); }
}
// Arquivo principal: o maior que não seja texto/imagem.
export function mainZipEntry(file) {
 const list = zipEntries(file).filter(e => !/\.(?:txt|nfo|diz|png|jpe?g|xml|dat|sav|srm|cht|url)$/i.test(e.name));
 return list.sort((a, b) => b.unpacked - a.unpacked)[0] || null;
}
export function readZipEntry(file, entry, max = 64 * 1024 * 1024) {
 if (entry.unpacked > max || entry.packed > max) throw Error('Arquivo compactado muito grande para identificar.');
 const fd = fs.openSync(file, 'r');
 try {
  const head = Buffer.alloc(30);
  fs.readSync(fd, head, 0, 30, entry.local);
  if (head.readUInt32LE(0) !== 0x04034b50) throw Error('ZIP inválido.');
  const start = entry.local + 30 + head.readUInt16LE(26) + head.readUInt16LE(28), data = Buffer.alloc(entry.packed);
  fs.readSync(fd, data, 0, entry.packed, start);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data, {maxOutputLength: max});
  throw Error('Método de compressão ZIP não suportado.');
 } finally { fs.closeSync(fd); }
}

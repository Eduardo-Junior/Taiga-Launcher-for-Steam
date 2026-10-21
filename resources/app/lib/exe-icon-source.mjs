// Ícone certo de um jogo encontrado no PC. O ícone do próprio .exe nem sempre existe: os jogos do Xbox/Game Pass abrem
// por "gamelaunchhelper.exe" (sem ícone) e muitos ports e jogos soltos não gravam ícone no executável. Ordem:
//  1. Logo do pacote do Xbox/Microsoft Store (MicrosoftGame.config ou AppxManifest.xml), na maior escala disponível;
//  2. O próprio .exe, se tiver ícone gravado;
//  3. Outro .exe com ícone na mesma pasta (ou na pasta do jogo), o maior primeiro.
import fs from 'node:fs';
import path from 'node:path';

const isFile = f => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const AUX = /^(unins|setup|install|crash|report|vc_?redist|dxsetup|dotnet|ue4prereq|uecrash|launcherhelper|gamelaunchhelper|easyanticheat|be(service|launcher)|update|patch|config|helper|cefprocess|steamwebhelper)/i;

// O .exe tem um grupo de ícones (RT_GROUP_ICON = 14) nos recursos? Lê só os cabeçalhos, sem carregar o arquivo.
export function peHasIcon(file) {
 let fd;
 try {
  fd = fs.openSync(file, 'r');
  const read = (pos, len) => { const b = Buffer.alloc(len); const n = fs.readSync(fd, b, 0, len, pos); return n === len ? b : null; };
  const dos = read(0, 64); if (!dos || dos.readUInt16LE(0) !== 0x5a4d) return false;
  const pe = dos.readUInt32LE(0x3c), head = read(pe, 24); if (!head || head.readUInt32LE(0) !== 0x4550) return false;
  const sections = head.readUInt16LE(6), optSize = head.readUInt16LE(20), opt = read(pe + 24, optSize); if (!opt) return false;
  const magic = opt.readUInt16LE(0), dirAt = magic === 0x20b ? 112 : 96; if (optSize < dirAt + 24) return false;
  const rva = opt.readUInt32LE(dirAt + 16), size = opt.readUInt32LE(dirAt + 20); if (!rva || !size) return false;
  const table = read(pe + 24 + optSize, sections * 40); if (!table) return false;
  let offset = -1;
  for (let i = 0; i < sections; i++) { const va = table.readUInt32LE(i * 40 + 12), vs = Math.max(table.readUInt32LE(i * 40 + 8), table.readUInt32LE(i * 40 + 16)), raw = table.readUInt32LE(i * 40 + 20); if (rva >= va && rva < va + vs) { offset = raw + (rva - va); break; } }
  if (offset < 0) return false;
  const dir = read(offset, 16); if (!dir) return false;
  const named = dir.readUInt16LE(12), ids = dir.readUInt16LE(14); if (named + ids > 4096) return false;
  const entries = read(offset + 16, (named + ids) * 8); if (!entries) return false;
  for (let i = named; i < named + ids; i++) if (entries.readUInt32LE(i * 8) === 14) return true;
  return false;
 } catch { return false; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}

// Logo do pacote: o arquivo citado no manifesto pode existir só com sufixo de escala (Logo.scale-200.png).
function packageLogo(dir) {
 for (const [file, attrs] of [['MicrosoftGame.config', ['Square150x150Logo', 'Square480x480Logo', 'StoreLogo', 'Square44x44Logo']], ['AppxManifest.xml', ['Square150x150Logo', 'Square44x44Logo', 'Logo']]]) {
  let text = ''; try { text = fs.readFileSync(path.join(dir, file), 'utf8'); } catch { continue; }
  for (const attr of attrs) {
   const rel = text.match(new RegExp(attr + '\\s*=\\s*"([^"]+)"', 'i'))?.[1] || text.match(new RegExp('<' + attr + '>([^<]+)<', 'i'))?.[1];
   if (!rel || /^ms-/i.test(rel) || rel.includes('..')) continue;
   const full = path.join(dir, ...rel.split(/[\\/]/));
   if (isFile(full) && /\.png$/i.test(full)) return full;
   const folder = path.dirname(full), stem = path.basename(full).replace(/\.png$/i, '').toLowerCase();
   let names = []; try { names = fs.readdirSync(folder); } catch {}
   const variants = names.filter(n => n.toLowerCase().startsWith(stem + '.') && /\.png$/i.test(n) && !/altform|contrast|unplated|light/i.test(n)).map(n => ({n, s: Number(n.match(/(?:scale|targetsize)-(\d+)/i)?.[1] || 0)})).sort((a, b) => b.s - a.s);
   if (variants[0]) return path.join(folder, variants[0].n);
  }
 }
 return '';
}

export function iconSourceFor(exe, root = '') {
 const dirs = [...new Set([path.dirname(exe), root, path.dirname(path.dirname(exe))].filter(Boolean))];
 for (const d of dirs) { const logo = packageLogo(d); if (logo) return {png: logo}; }
 if (peHasIcon(exe)) return {exe};
 for (const d of dirs.slice(0, 2)) {
  let names = []; try { names = fs.readdirSync(d); } catch { continue; }
  const others = names.filter(n => /\.exe$/i.test(n) && !AUX.test(n)).map(n => path.join(d, n)).filter(f => f.toLowerCase() !== exe.toLowerCase() && isFile(f));
  others.sort((a, b) => { try { return fs.statSync(b).size - fs.statSync(a).size; } catch { return 0; } });
  for (const f of others.slice(0, 6)) if (peHasIcon(f)) return {exe: f};
 }
 return {exe};
}

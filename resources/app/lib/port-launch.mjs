// Ports que abrem numa tela de configurações antes do jogo (ex.: God of War III do SpartanPort): ao lado do .exe
// principal existe um iniciador pequeno ("Play God of War III.exe") que só chama o principal com um argumento
// (--play) e espera. O Taiga Launcher usa o mesmo argumento direto no .exe principal: o jogo abre na hora e o
// tempo de jogo e as conquistas continuam ligados ao processo certo. Se o argumento não for encontrado, usa o
// próprio iniciador (ele espera o jogo fechar, então o tempo de jogo também conta certo).
import fs from 'node:fs';
import path from 'node:path';

const MAX_WRAPPER = 2 * 1024 * 1024;
const wide = buf => { const out = []; let cur = ''; for (let i = 0; i + 1 < buf.length; i += 2) { const c = buf.readUInt16LE(i); if (c >= 32 && c < 0xfffe && c !== 0x7f) cur += String.fromCharCode(c); else { if (cur.length >= 3) out.push(cur); cur = ''; } } if (cur.length >= 3) out.push(cur); return out; };
const ascii = buf => (buf.toString('latin1').match(/[\x20-\x7e]{3,}/g) || []);

export function directPlay(exe) {
 if (!exe || !/\.exe$/i.test(exe)) return null;
 const dir = path.dirname(exe), base = path.basename(exe).toLowerCase();
 let names = []; try { names = fs.readdirSync(dir); } catch { return null; }
 const candidates = names.filter(n => /\.exe$/i.test(n) && n.toLowerCase() !== base && /^(play|start|launch|run)\b/i.test(n));
 for (const n of candidates) {
  const file = path.join(dir, n);
  let buf; try { const st = fs.statSync(file); if (!st.isFile() || st.size > MAX_WRAPPER) continue; buf = fs.readFileSync(file); } catch { continue; }
  if (buf.readUInt16LE(0) !== 0x5a4d) continue;
  const strings = [...wide(buf), ...ascii(buf)];
  // O iniciador cita o .exe principal pelo nome.
  if (!strings.some(s => s.toLowerCase().includes(base))) continue;
  // Modelo da linha de comando: "%ls" --play%ls  →  --play
  let args = '';
  for (const s of strings) { const m = s.match(/"%l?s"\s+((?:--?[A-Za-z][\w-]*\s*)+)/); if (m) { args = m[1].trim(); break; } }
  return args ? {args, wrapper: file} : {exe: file, wrapper: file};
 }
 return null;
}

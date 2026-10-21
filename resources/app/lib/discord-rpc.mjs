// Discord: mostra o jogo aberto pelo Taiga Launcher no perfil, como um jogo da Steam ("Jogando God of War III",
// capa, plataforma e tempo de sessão). Usa o canal local do aplicativo do Discord (Rich Presence por IPC):
// nada sai pela internet a partir daqui e nada acontece se o Discord estiver fechado.
// Protocolo: quadros [op int32 LE][tamanho int32 LE][JSON]; op 0 = handshake, 1 = comando, 2 = fechar, 3/4 = ping/pong.
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';

export function encodeFrame(op, data) { const body = Buffer.from(JSON.stringify(data)), head = Buffer.alloc(8); head.writeInt32LE(op, 0); head.writeInt32LE(body.length, 4); return Buffer.concat([head, body]); }
export function decodeFrames(buf) { const out = []; let at = 0; while (buf.length - at >= 8) { const op = buf.readInt32LE(at), len = buf.readInt32LE(at + 4); if (buf.length - at - 8 < len) break; let data = null; try { data = JSON.parse(buf.toString('utf8', at + 8, at + 8 + len)); } catch {} out.push({op, data}); at += 8 + len; } return {frames: out, rest: buf.subarray(at)}; }

export function ipcPaths(env = process.env, platform = process.platform) {
 if (platform === 'win32') return Array.from({length: 10}, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
 const base = env.XDG_RUNTIME_DIR || env.TMPDIR || env.TMP || env.TEMP || '/tmp';
 const dirs = [base, path.join(base, 'app', 'com.discordapp.Discord'), path.join(base, 'snap.discord'), path.join(base, '.flatpak', 'com.discordapp.Discord', 'xdg-run')];
 return dirs.flatMap(d => Array.from({length: 10}, (_, i) => path.join(d, `discord-ipc-${i}`)));
}

const cut = (s, n = 128) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
// Atividade no formato da Steam: nome do jogo no status ("Jogando <jogo>"), plataforma embaixo, capa e tempo.
export function buildActivity({title, platform = '', cover = '', startedAt = null, appName = 'Taiga Launcher', smallImage = 'taiga'}) {
 const a = {type: 0, details: cut(title), status_display_type: 2, instance: false};
 if (platform) a.state = cut(platform);
 const start = Date.parse(startedAt || ''); if (Number.isFinite(start)) a.timestamps = {start};
 const assets = {};
 if (/^https:\/\//.test(cover)) { assets.large_image = cover; assets.large_text = cut(title); }
 else { assets.large_image = smallImage; assets.large_text = appName; }
 if (assets.large_image !== smallImage) { assets.small_image = smallImage; assets.small_text = appName; }
 a.assets = assets;
 return a;
}

export class DiscordPresence {
 constructor({clientId, log = () => {}, paths = ipcPaths(), connect = p => net.createConnection(p)} = {}) { Object.assign(this, {clientId: String(clientId || ''), log, paths, connect}); this.sock = null; this.ready = false; this.want = undefined; this.sent = ''; this.retryAt = 0; this.buf = Buffer.alloc(0); }
 // Atividade desejada (null = limpar). Pode ser chamada a cada poucos segundos; só envia quando muda.
 async set(activity) { this.want = activity; await this.flush(); }
 async flush() {
  if (!/^\d{17,20}$/.test(this.clientId)) return false;
  const key = JSON.stringify(this.want ?? null);
  if (this.ready && key === this.sent) return true;
  if (!this.ready) { if (this.want == null) { this.sent = key; return true; } if (!(await this.open())) return false; }
  try { this.sock.write(encodeFrame(1, {cmd: 'SET_ACTIVITY', args: {pid: process.pid, activity: this.want ?? null}, nonce: crypto.randomUUID()})); this.sent = key; return true; } catch { this.drop(); return false; }
 }
 async open() {
  if (Date.now() < this.retryAt) return false;
  this.retryAt = Date.now() + 15000;
  for (const p of this.paths) {
   const ok = await new Promise(resolve => {
    let sock; try { sock = this.connect(p); } catch { return resolve(false); }
    const fail = () => { try { sock.destroy(); } catch {} resolve(false); };
    const timer = setTimeout(fail, 3000);
    sock.once('error', () => { clearTimeout(timer); fail(); });
    sock.once('connect', () => {
     sock.write(encodeFrame(0, {v: 1, client_id: this.clientId}));
     sock.on('data', chunk => {
      this.buf = Buffer.concat([this.buf, chunk]); const {frames, rest} = decodeFrames(this.buf); this.buf = rest;
      for (const f of frames) {
       if (f.op === 1 && f.data?.evt === 'READY' && !this.ready) { clearTimeout(timer); this.sock = sock; this.ready = true; this.log('Discord conectado.'); resolve(true); }
       else if (f.op === 3) { try { sock.write(encodeFrame(4, f.data)); } catch {} }
       else if (f.op === 2 || f.data?.evt === 'ERROR') { if (!this.ready) { clearTimeout(timer); fail(); } else this.log('Discord: ' + (f.data?.data?.message || f.data?.message || 'recusou')); }
      }
     });
     sock.once('close', () => { if (this.sock === sock) this.drop(); });
    });
   });
   if (ok) return true;
  }
  return false;
 }
 drop() { try { this.sock?.destroy(); } catch {} this.sock = null; this.ready = false; this.sent = ''; this.buf = Buffer.alloc(0); }
 close() { try { if (this.ready) this.sock.write(encodeFrame(1, {cmd: 'SET_ACTIVITY', args: {pid: process.pid, activity: null}, nonce: crypto.randomUUID()})); } catch {} this.drop(); }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const LANGS = ['pt-BR', 'en', 'es', 'fr', 'de'];

test('1.6.2: store games show the store as platform (Epic Games, GOG…)', () => {
  assert.match(server, /storeLabel:g\.store\?\.label\|\|''/);
  assert.match(app, /function gamePlat\(g\)\{return g\.storeLabel\|\|platShort\(g\.platformName\);\}/);
  assert.match(app, /\[T\('detail\.platform'\),gamePlat\(g\)\]/);
  assert.ok(!app.includes("platformLabel(g.platformName).split(' · ')[0]"), 'every platform label goes through gamePlat');
});

test('1.6.2: first-run tutorial removed', () => {
  for (const s of ['TIPS', 'maybeTips', 'showTip', 'closeTips', 'tip-layer']) assert.ok(!app.includes(s), s);
  assert.ok(!/#tip-layer|\.tip-bubble|\.tip-spot/.test(css));
  for (const l of LANGS) {
    const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
    assert.ok(!Object.keys(d).some(k => k.startsWith('tips.')), l);
  }
});

test('1.6.2: Steam game sheet, Steam data, art panel, translated', () => {
  assert.match(app, /class="nd-hero"/);
  assert.ok(!app.includes("T('native.lastPlayed')"), '1.8.0: Steam game sheet no longer shows last played');
  assert.match(app, /data-act="native-apply"/);
  assert.match(server + fs.readFileSync(new URL('../lib/steam-library.mjs', import.meta.url), 'utf8'), /lastPlayed:g\.rtime_last_played/);
  for (const l of LANGS) {
    const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
    for (const k of ['native.artTitle', 'native.ready']) assert.ok(d[k], `${l}:${k}`);
    assert.ok(d['native.ready'].includes('{count}'));
  }
});

test('1.6.2: account icons come from each service site (no embedded logos), with letter fallback', async () => {
  const {iconLinks, sniffImage, downloadBrandIcon, brandIcons} = await import('../lib/brand-icons.mjs');
  const html = '<link rel="icon" href="/f32.png" sizes="32x32"><link rel="apple-touch-icon" href="https://cdn.x/a180.png"><link rel="icon" href="/logo.svg">';
  assert.deepEqual(iconLinks(html, 'https://site.test/'), ['https://cdn.x/a180.png', 'https://site.test/f32.png']);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  assert.equal(sniffImage(png), 'image/png');
  assert.equal(sniffImage(Buffer.from('<svg onload=alert(1)>')), null);
  const seen = [];
  const fake = async u => { seen.push(u); return u.endsWith('/') ? new Response(html) : u.includes('a180') ? new Response(png) : new Response('', {status: 404}); };
  const got = await downloadBrandIcon('gog', fake);
  assert.equal(got.type, 'image/png');
  const os = await import('node:os'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'));
  let calls = 0;
  const icon = brandIcons(dir, async u => { calls++; return fake(u); });
  assert.ok(await icon('ra'));
  const before = calls;
  assert.ok(await icon('ra'));
  assert.equal(calls, before, 'second read comes from the cache');
  assert.equal(await icon('steam'), null);
  const offline = brandIcons(fs.mkdtempSync(path.join(os.tmpdir(), 'brand-')), async () => { throw Error('offline'); });
  assert.equal(await offline('epic'), null);
  assert.match(app, /<img src="\/brand\/\$\{kind\}" alt="">/);
  assert.match(app, /classList\.add\('no-img'\)/);
});

test('1.6.2: Accounts screen without the Steam row and without game covers', () => {
  assert.ok(!app.includes('coverFan'));
  assert.ok(!app.includes('data-kind="steam"'));
  assert.ok(!/^\.fan/m.test(css));
});

test('1.6.2: playtime and last played read from Steam localconfig.vdf (no Web API key)', async () => {
  const {localPlaytime} = await import('../lib/steam-library.mjs');
  const os = await import('node:os'), path = await import('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-')), cfg = path.join(dir, 'userdata', '42', 'config');
  fs.mkdirSync(cfg, {recursive: true});
  fs.writeFileSync(path.join(cfg, 'localconfig.vdf'), '"UserLocalConfigStore"\n{\n "Software"\n {\n  "Valve"\n  {\n   "Steam"\n   {\n    "apps"\n    {\n     "1490890"\n     {\n      "LastPlayed"  "1760000000"\n      "Playtime"  "321"\n     }\n     "10"\n     {\n      "cloud" { "last_sync_state" "synchronized" }\n     }\n    }\n   }\n  }\n }\n}\n');
  const m = localPlaytime(dir, '42');
  assert.deepEqual(m.get(1490890), {playtime: 321, lastPlayed: 1760000000});
  assert.equal(m.has(10), false);
  assert.equal(localPlaytime(dir, 'nope').size, 0);
  assert.match(fs.readFileSync(new URL('../web/achievement-view.css', import.meta.url), 'utf8'), /\.ts-ach-reveal\{[^}]*color:#fff/);
});

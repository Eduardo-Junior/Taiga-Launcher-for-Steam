import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const app = fs.readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../web/style.css', import.meta.url), 'utf8');
const LANGS = ['pt-BR', 'en', 'es', 'fr', 'de'];

test('1.7.0: store layout, sidebar and top search', () => {
  assert.match(app, /function shell\(body\)\{return `<div class="shell/);
  assert.match(app, /\$\('#app'\)\.innerHTML=shell\(body\)/);
  for (const v of ['library', 'steam', 'owned', 'accounts', 'settings']) assert.match(app, new RegExp(`it\\('${v}'`), v);
  assert.match(css, /\.sb-it\.on\{background:var\(--text\);color:var\(--bg\)\}/);
  for (const l of LANGS) {
    const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
    for (const k of ['sb.menu', 'sb.recent', 'top.theme', 'lib.next', 'lib.details']) assert.ok(d[k], `${l}:${k}`);
  }
});

test('1.8.2: the default theme is dark; everyone moves to dark once (can change later)', async () => {
  const {createApp} = await import('../server.mjs');
  for (const before of ['system', 'light', 'dark', undefined]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v18-'));
    if (before) fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({preferences: {theme: before}, designV17: true}));
    const a = createApp({dataDir: dir, port: 0});
    a.server.close?.();
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
    assert.equal(cfg.preferences.theme, 'dark', String(before));
    assert.equal(cfg.designV18, true);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v18b-'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({preferences: {theme: 'light'}, designV18: true}));
  createApp({dataDir: dir, port: 0}).server.close?.();
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8')).preferences.theme, 'light', 'a later choice is kept');
});

test('1.7.1: clean home, promo banner (Discord, add all, accounts), tabs, cover+title cards, no side panel', () => {
  assert.ok(!app.includes('rightPanel'));
  assert.match(app, /function promo\(games\)/);
  assert.match(app, /const LINKS=\{discord:/);
  assert.match(app, /data-act="add-all"/);
  assert.match(app, /data-act="lib-tab"/);
  assert.ok(!app.includes('cv-ok'), 'no check mark on covers');
  assert.ok(!/class="card-k"/.test(app));
  const main = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
  assert.match(main, /discord\\\.gg/);
  for (const l of LANGS) {
    const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
    for (const k of ['lib.title', 'lib.tabAll', 'lib.tabAdd', 'lib.tabIn', 'promo.dTitle', 'promo.dBtn', 'promo.soon', 'promo.aTitle', 'promo.cTitle', 'promo.cNeed']) assert.ok(d[k], `${l}:${k}`);
    assert.ok(!Object.keys(d).some(k => k.startsWith('rp.')), l);
  }
});

test('1.7.2: promo order add → achievements → donation with own illustrations (no cover wall); neutral pending notices', () => {
  const i = app.indexOf('function promoSlides('), body = app.slice(i, app.indexOf('function promo(games)'));
  assert.ok(body.indexOf("k:'add'") < body.indexOf("k:'ach'") && body.indexOf("k:'ach'") < body.indexOf("k:'donate'"));
  assert.match(app, /const PROMO_ART=\{/);
  assert.ok(!app.includes('pw-col'));
  assert.match(app, /class="ltabs"/);
  assert.match(app, /data-act="sync-pending"/);
  assert.ok(!/warn-p\{background:color-mix\(in srgb,#e5a13a/.test(css.slice(css.indexOf('1.7.2'))));
  assert.match(css, /\.qa\{background:#121212/);
  for (const l of LANGS) {
    const d = JSON.parse(fs.readFileSync(new URL(`../locales/${l}.json`, import.meta.url), 'utf8'));
    for (const k of ['lib.confirm', 'lib.select', 'steam.updateAll']) assert.ok(d[k], `${l}:${k}`);
  }
});

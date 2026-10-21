// TaigaSteam 1.4.0, identificação por pasta/cabeçalho/serial/hash, contas RA dos emuladores,
// troféus Vita3K/shadPS4, busca agrupada por plataforma e importação de lojas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectGame, scanGames, launchFor} from '../lib/games.mjs';
import {platformFromFolderName, platformFromPath, platformByName, samePlatform} from '../lib/platforms.mjs';
import {parseRomName, cleanPCTitle, normalizeSerial} from '../lib/rom-name.mjs';
import {similarity, scoreCandidate, confidentChoice} from '../lib/title-match.mjs';
import {parseDat, buildIndex, DatIndex, libretroThumbnailURL} from '../lib/dat-index.mjs';
import {raHash, RA_BUFFER_HASHES} from '../lib/ra-hash.mjs';
import {platformByKey} from '../lib/platforms.mjs';
import {emulatorAccounts, parseIni} from '../lib/emulator-accounts.mjs';
import {parseVita3KProgress, parsePS4Unlocks, readVita3K, readShadPS4, trophyTime} from '../lib/console-trophies.mjs';
import {externalResults} from '../lib/external.mjs';
import {identifyLocal, displayTitle, steamAppIdNear, pcNames} from '../lib/identify.mjs';
import {scanEpic, scanGOG} from '../lib/stores.mjs';
import {RetroAchievements} from '../lib/retroachievements.mjs';
import {createApp} from '../server.mjs';
import {Providers} from '../lib/providers.mjs';
import {iso} from './fixtures.mjs';

const md5 = (...parts) => { const h = crypto.createHash('md5'); for (const p of parts) h.update(p); return h.digest('hex'); };
function temp(t) { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'taiga-140-')); t.after(() => fs.rmSync(p, {recursive: true, force: true})); return p; }
function file(root, rel, content = 'x') { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, content); return f; }
// ISO 9660 mínima com arquivos na raiz.
function isoWith(files) {
 const sectors = 20 + files.reduce((n, f) => n + Math.ceil(f[1].length / 2048) + 1, 0) + 4, b = Buffer.alloc(sectors * 2048);
 b[16 * 2048] = 1; b.write('CD001', 16 * 2048 + 1);
 const rec = (name, sector, size, dir = false) => { const r = Buffer.alloc(34 + name.length + (name.length % 2 ? 0 : 1)); r[0] = r.length; r.writeUInt32LE(sector, 2); r.writeUInt32LE(size, 10); r[25] = dir ? 2 : 0; r[32] = name.length; r.write(name, 33); return r; };
 rec('\0', 20, 2048, true).subarray(0, 34).copy(b, 16 * 2048 + 156);
 let at = 20 * 2048, sector = 21;
 for (const [name, data] of files) { const r = rec(name + ';1', sector, data.length); r.copy(b, at); at += r.length; data.copy(b, sector * 2048); sector += Math.ceil(data.length / 2048) + 1; }
 return b;
}
// Converte ISO (2048) em BIN cru Mode2 (2352) para testar o leitor de setores.
function toRawMode2(isoBuf) {
 const n = isoBuf.length / 2048, out = Buffer.alloc(n * 2352), sync = Buffer.from([0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0]);
 for (let i = 0; i < n; i++) { sync.copy(out, i * 2352); out[i * 2352 + 15] = 2; isoBuf.copy(out, i * 2352 + 24, i * 2048, (i + 1) * 2048); }
 return out;
}

test('Nomes de pasta e de arquivo indicam plataforma, região, disco e serial', () => {
 for (const [folder, key] of [['PS2', 'ps2'], ['Sony - PlayStation 2', 'ps2'], ['ROMs PS2', 'ps2'], ['psx', 'ps1'], ['Jogos PSP', 'psp'], ['Nintendo - Game Boy Advance', 'gba'], ['snes', 'snes'], ['Mega Drive', 'genesis'], ['gamecube', 'gc'], ['DS', 'nds']]) assert.equal(platformFromFolderName(folder)?.key, key, folder);
 assert.equal(platformFromFolderName('Arcade Paradise'), null);
 assert.equal(platformFromPath(path.join('D:', 'Roms', 'ps2', 'God of War', 'God of War.iso'))?.platform.key, 'ps2');
 const n = parseRomName('Legend of Zelda, The - Ocarina of Time (USA) (Rev 2).z64');
 assert.equal(n.title, 'The Legend of Zelda - Ocarina of Time'); assert.deepEqual(n.regions, ['USA']); assert.equal(n.revision, '2');
 const d = parseRomName('Final Fantasy VII (USA) (Disc 2).cue'); assert.equal(d.disc, 2); assert.equal(d.title, 'Final Fantasy VII');
 assert.equal(parseRomName('God of War II (USA) [SLUS-21643].iso').serial, 'SLUS-21643');
 assert.equal(normalizeSerial('SLUS_209.46'), 'SLUS-20946');
 assert.equal(cleanPCTitle('Elden.Ring.v1.12-CODEX'), 'Elden Ring');
 assert.equal(cleanPCTitle('Hollow Knight [FitGirl Repack]'), 'Hollow Knight');
 assert.equal(cleanPCTitle('Hades-Win64-Shipping.exe'), 'Hades');
 assert.ok(samePlatform('Sega Master System', 'Sega Master System/Mark III'));
 assert.equal(platformByName('PSP').key, 'psp');
});

test('Comparação de títulos evita sequências e edições diferentes e só aceita escolha clara', () => {
 assert.ok(similarity('Final Fantasy VII', 'Final Fantasy 7') > .95);
 assert.ok(scoreCandidate('God of War', 'God of War II', {platformMatch: true}).score < .8);
 assert.ok(scoreCandidate('Ratchet and Clank', 'Ratchet & Clank', {platformMatch: true}).score >= .99);
 assert.ok(scoreCandidate('Patapon', 'Patapon', {platformMatch: false}).score < scoreCandidate('Patapon', 'Patapon', {platformMatch: true}).score);
 const list = ['Patapon', 'Patapon 2', 'Patapon 3'].map(name => ({name, ...scoreCandidate('Patapon', name, {platformMatch: true})}));
 assert.equal(confidentChoice(list).name, 'Patapon');
 const tie = ['Spider-Man', 'Spider-Man'].map(name => ({name, ...scoreCandidate('Spider-Man', name, {platformMatch: true})}));
 assert.equal(confidentChoice(tie), null);
 assert.equal(displayTitle('Grand Theft Auto - San Andreas'), 'Grand Theft Auto: San Andreas');
});

test('Pastas de plataforma identificam CHD/ZIP/BIN de cartucho; arquivos genéricos fora delas são ignorados', t => {
 const root = temp(t);
 const chd = file(root, 'roms/ps2/Shadow of the Colossus (USA).chd', 'MComprHD');
 const gen = file(root, 'roms/megadrive/Sonic the Hedgehog (USA, Europe).bin', Buffer.alloc(1024));
 file(root, 'docs/readme.md', '# not a game');
 const zip = file(root, 'roms/arcade/sf2.zip', Buffer.from('PK\x05\x06' + '\0'.repeat(18), 'latin1'));
 const found = scanGames(root);
 assert.ok(found.includes(chd)); assert.ok(found.includes(gen)); assert.ok(found.includes(zip)); assert.ok(!found.some(f => f.endsWith('.md')));
 const g = inspectGame(chd);
 assert.equal(g.platformKey, 'ps2'); assert.equal(g.profile, 'ps2'); assert.equal(g.platformSource, 'folder'); assert.equal(g.title, 'Shadow of the Colossus'); assert.deepEqual(g.region, ['USA']);
 assert.equal(inspectGame(gen).platformKey, 'genesis');
 const a = inspectGame(zip); assert.equal(a.platformKey, 'arcade'); assert.equal(a.profile, 'mame');
 assert.deepEqual(launchFor({...a, launch: {exe: process.execPath}}, {}, ''), {exe: process.execPath, args: '-rompath "' + path.dirname(zip) + '" sf2'});
});

test('Discos múltiplos sem .m3u entram uma vez; cabeçalhos de cartucho definem a plataforma', t => {
 const root = temp(t);
 for (const n of [1, 2, 3]) file(root, `psx/Final Fantasy VII (USA) (Disc ${n}).chd`, 'MComprHD');
 assert.equal(scanGames(path.join(root, 'psx')).length, 1);
 const gba = Buffer.alloc(0x200); gba[3] = 0xea; gba.write('POKEMON EMER', 0xa0, 'latin1'); gba.write('BPEE', 0xac, 'latin1'); gba[0xb2] = 0x96;
 const g = inspectGame(file(root, 'unknown/game.gba', gba));
 assert.equal(g.platformKey, 'gba'); assert.equal(g.serial, 'BPEE'); assert.equal(g.internalTitle, 'POKEMON EMER');
 const nds = Buffer.alloc(0x200); nds.write('MARIO KART', 0, 'latin1'); nds.write('AMCE', 0x0c, 'latin1'); nds.writeUInt16LE(0xcf56, 0x15c);
 assert.equal(inspectGame(file(root, 'x/mk.nds', nds)).platformKey, 'nds');
});

test('PS1 em BIN cru (2352) e PS2 em ISO: serial lido e hash RetroAchievements no formato rcheevos', t => {
 const root = temp(t);
 const exe = Buffer.alloc(4096); exe.write('PS-X EXE', 0, 'latin1'); exe.writeUInt32LE(1024, 28);
 const ps1 = isoWith([['SYSTEM.CNF', Buffer.from('BOOT = cdrom:\\SLUS_007.10;1\r\nTCB = 4\r\n')], ['SLUS_007.10', exe]]);
 const bin = file(root, 'psx/Game (USA).bin', toRawMode2(ps1)), cue = file(root, 'psx/Game (USA).cue', 'FILE "Game (USA).bin" BINARY\n  TRACK 01 MODE2/2352\n    INDEX 01 00:00:00\n');
 const g = inspectGame(cue);
 assert.equal(g.platformKey, 'ps1'); assert.equal(g.serial, 'SLUS-00710'); assert.equal(g.discId, 'SLUS00710');
 assert.equal(raHash(cue, platformByKey('ps1')), md5(Buffer.from('SLUS_007.10'), exe.subarray(0, 1024 + 2048)));
 assert.ok(!scanGames(path.join(root, 'psx')).includes(bin));
 const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(3000)]);
 const ps2 = file(root, 'any/disc.iso', isoWith([['SYSTEM.CNF', Buffer.from('BOOT2 = cdrom0:\\SLES_123.45;1\r\n')], ['SLES_123.45', elf]]));
 assert.equal(inspectGame(ps2).platformKey, 'ps2');
 assert.equal(raHash(ps2, platformByKey('ps2')), md5(Buffer.from('SLES_123.45'), elf));
});

test('Hashes de cartucho seguem as regras do RetroAchievements', () => {
 const rom = Buffer.from('ABCDEFGH'.repeat(1024));
 assert.equal(RA_BUFFER_HASHES.nes(Buffer.concat([Buffer.from('NES\x1a', 'latin1'), Buffer.alloc(12), rom])), md5(rom));
 assert.equal(RA_BUFFER_HASHES.snes(Buffer.concat([Buffer.alloc(512), rom])), md5(rom));
 const z64 = Buffer.from([0x80, 0x37, 0x12, 0x40, 1, 2, 3, 4]), v64 = Buffer.from([0x37, 0x80, 0x40, 0x12, 2, 1, 4, 3]), n64 = Buffer.from([0x40, 0x12, 0x37, 0x80, 4, 3, 2, 1]);
 assert.equal(RA_BUFFER_HASHES.n64(v64), md5(z64)); assert.equal(RA_BUFFER_HASHES.n64(n64), md5(z64));
 assert.equal(raHash('/roms/arcade/sf2.zip', platformByKey('arcade')), md5(Buffer.from('sf2')));
 const nds = Buffer.alloc(0x2000); nds.writeUInt32LE(0x400, 0x20); nds.writeUInt32LE(0x10, 0x2c); nds.writeUInt32LE(0x800, 0x30); nds.writeUInt32LE(0x10, 0x3c); nds.writeUInt32LE(0x1000, 0x68); nds.fill(7, 0x400, 0x410); nds.fill(9, 0x800, 0x810);
 assert.equal(RA_BUFFER_HASHES.nds(nds), md5(nds.subarray(0, 0x160), nds.subarray(0x400, 0x410), nds.subarray(0x800, 0x810), nds.subarray(0x1000, 0x1a00)));
});

const DAT = `clrmamepro (\n\tname "Sony - PlayStation 2"\n)\n\ngame (\n\tname "Grand Theft Auto - San Andreas (USA) (v1.03)"\n\tregion "USA"\n\tserial "SLUS-20946"\n\trom ( name "Grand Theft Auto - San Andreas (USA) (v1.03).iso" size 4499767296 crc 1C5E0EEE md5 C383C015065F8060343032480928D08D sha1 x serial "SLUS-20946" )\n)\ngame (\n\tname "Grand Theft Auto - San Andreas (Europe) (En,Fr,De,Es,It)"\n\tregion "Europe"\n\tserial "SLES-52541"\n\trom ( name "x.iso" size 4600000000 crc 2C5E0EEE md5 d383c015065f8060343032480928d08d serial "SLES-52541" )\n)\ngame (\n\tname "Shadow of the Colossus (USA)"\n\tregion "USA"\n\tserial "SCUS-97472"\n\trom ( name "Shadow of the Colossus (USA).iso" size 2693955584 crc 2ED81371 md5 6d4a7a9d9c139a9d93db37538ba6d984 serial "SCUS-97472" )\n)\n`;
test('Banco Redump/No-Intro: serial, tamanho e nome localizam o dump; cache evita novo download', async t => {
 const dir = temp(t), games = parseDat(DAT);
 assert.equal(games.length, 3); assert.equal(buildIndex(games).bySerial.SLUS20946.length, 1);
 let downloads = 0;
 const dat = new DatIndex({dir, fetchText: async url => { downloads++; assert.match(url, /metadat\/redump\/Sony%20-%20PlayStation%202\.dat$/); return DAT; }});
 const ps2 = platformByKey('ps2');
 const bySerial = await dat.lookup(ps2, {serial: 'SLUS20946'});
 assert.equal(bySerial.title, 'Grand Theft Auto - San Andreas'); assert.equal(bySerial.by, 'serial');
 assert.equal((await dat.lookup(ps2, {serial: 'SLUS-20946', size: 4499767296})).confidence, .99);
 assert.equal((await dat.lookup(ps2, {title: 'Shadow of the Colossus'})).by, 'name');
 assert.equal(await dat.lookup(ps2, {serial: 'SLUS-99999'}), null);
 assert.equal(await dat.lookup(ps2, {title: 'constructor'}), null);
 assert.equal(buildIndex(parseDat('game (\n\tname "Constructor (USA)"\n\trom ( name "c.bin" size 1 crc 00000001 )\n)\n')).byTitle.constructor.length, 1);
 const again = new DatIndex({dir, fetchText: async () => { downloads++; return ''; }});
 assert.equal((await again.lookup(ps2, {serial: 'SCUS-97472'})).title, 'Shadow of the Colossus');
 assert.equal(downloads, 1);
 assert.equal(libretroThumbnailURL('Sony - PlayStation 2', 'Named_Boxarts', 'Ratchet & Clank (USA)'), 'https://thumbnails.libretro.com/Sony%20-%20PlayStation%202/Named_Boxarts/Ratchet%20_%20Clank%20(USA).png');
});

test('Identificação local aceita dump verificado e hash RA sem conta; título interno confiável é mantido', async () => {
 const providers = {datLookup: async () => ({name: 'Grand Theft Auto - San Andreas (USA) (v1.03)', title: 'Grand Theft Auto - San Andreas', by: 'serial', confidence: .95, set: 'redump', serials: ['SLUS20946']}), raGameId: async (hash, p) => { assert.equal(p.ra, 21); return hash === 'a'.repeat(32) ? 2569 : null; }};
 const item = {platformKey: 'ps2', title: 'arbitrary', serial: 'SLUS-20946', raHash: 'a'.repeat(32)};
 const r = await identifyLocal(item, {providers});
 assert.equal(r.automatic, true); assert.equal(item.title, 'Grand Theft Auto: San Andreas'); assert.equal(item.raId, 2569); assert.equal(item.canonicalName, 'Grand Theft Auto - San Andreas (USA) (v1.03)');
 const psp = {platformKey: 'psp', title: 'Patapon™', internalTitle: 'Patapon™', identitySource: 'PARAM.SFO'};
 await identifyLocal(psp, {providers});
 assert.equal(psp.title, 'Patapon™');
});

test('Resultados agrupados: plataforma detectada primeiro, DLC e edições recolhidas', () => {
 const found = {igdb: [
  {id: 1, name: 'Spider-Man', platforms: [{id: 7, name: 'PlayStation'}], first_release_date: 946684800},
  {id: 2, name: 'Spider-Man', platforms: [{id: 48, name: 'PlayStation 4'}], total_rating_count: 900},
  {id: 3, name: 'Spider-Man: Game of the Year', platforms: [{id: 48, name: 'PlayStation 4'}], version_parent: 2},
  {id: 4, name: 'Spider-Man: The City That Never Sleeps', platforms: [{id: 48, name: 'PlayStation 4'}], game_type: {type: 'DLC'}},
 ], sgdb: []};
 const items = externalResults(found, {platformKey: 'ps1', query: 'Spider-Man'});
 assert.deepEqual(items.map(i => i.igdb.id), [1, 2]);
 assert.equal(items[0].platformMatch, true); assert.equal(items[1].platformMatch, false);
});

test('Conta RetroAchievements dos emuladores é lida sem pedir login; tokens inválidos são ignorados', t => {
 const home = temp(t), docs = path.join(home, 'Documents'), appdata = path.join(home, 'AppData', 'Roaming');
 file(docs, 'PCSX2/inis/PCSX2.ini', '[Achievements]\nEnabled = true\nUsername = player1\nToken = AbCdEf0123456789\n');
 file(docs, 'DuckStation/settings.ini', '[Cheevos]\nUsername = player1\nToken = AbCdEf0123456789\n');
 file(appdata, 'RetroArch/retroarch.cfg', 'cheevos_enable = "true"\ncheevos_username = "player2"\ncheevos_token = "ZyXwVu9876543210"\n');
 file(docs, 'PPSSPP/PSP/SYSTEM/ppsspp.ini', '[Achievements]\nAchievementsEnable = True\nAchievementsUserName = player3\n');
 file(docs, 'PPSSPP/PSP/SYSTEM/ppsspp_retroachievements.dat', 'TokEn1234567890ab\n');
 file(appdata, 'Dolphin Emulator/Config/RetroAchievements.ini', '[Achievements]\nUsername = player4\nApiToken = ENCRYPTED:++//==\n');
 const list = emulatorAccounts({}, {USERPROFILE: home, APPDATA: appdata});
 const byUser = Object.fromEntries(list.map(a => [a.user, a]));
 assert.deepEqual(byUser.player1.emulators.sort(), ['DuckStation', 'PCSX2']);
 assert.equal(byUser.player2.emulator, 'RetroArch'); assert.equal(byUser.player3.token, 'TokEn1234567890ab');
 assert.equal(byUser.player4, undefined);
 assert.equal(parseIni('[A]\nb = "c"\n').a.b, 'c');
});

test('RetroAchievements: identificação pela biblioteca de hashes e progresso pelo token, só leitura', async t => {
 const dir = temp(t), calls = [];
 const fetchImpl = async (url, options) => {
  const params = new URLSearchParams(options.method === 'GET' ? url.split('?')[1] : String(options.body));
  calls.push(params.get('r')); assert.match(options.headers['User-Agent'], /^TaigaLauncher\//);
  assert.ok(!['startsession', 'awardachievement', 'awardachievements', 'ping'].includes(params.get('r')));
  const body = params.get('r') === 'hashlibrary' ? {Success: true, MD5List: {['b'.repeat(32)]: 11}} : params.get('r') === 'patch' ? {Success: true, PatchData: {ID: 11, Title: 'Game', ConsoleID: 41, Achievements: [{ID: 1, Title: 'A', Description: 'd', Points: 5, BadgeName: '001', Flags: 3, Rarity: 12.5}, {ID: 2, Title: 'B', Description: 'd', Points: 5, BadgeName: '002', Flags: 3}, {ID: 3, Title: 'Unofficial', Flags: 5, BadgeName: '3'}]}} : params.get('r') === 'unlocks' ? {Success: true, UserUnlocks: params.get('h') === '1' ? [2] : [1]} : {Success: false, Error: 'x'};
  return new Response(JSON.stringify(body), {status: 200});
 };
 const ra = new RetroAchievements({dir, config: () => ({raUseEmulatorAccounts: false}), fetchImpl});
 ra.last = 0;
 assert.equal(await ra.gameIdForHash('B'.repeat(32), 41), 11);
 const progress = await ra.progressByToken(11, {user: 'player', token: 'AbCdEf0123456789'});
 assert.equal(progress.total, 2); assert.equal(progress.unlocked, 2); assert.equal(progress.achievements[1].hardcore, true); assert.equal(progress.achievements[0].globalPercent, 12.5);
 assert.deepEqual(calls, ['hashlibrary', 'patch', 'unlocks', 'unlocks']);
});

test('Troféus do Vita3K e do shadPS4 são lidos dos arquivos locais', t => {
 const root = temp(t);
 // Vita3K: magic, bits desbloqueados, bits ocultos, contagens, timestamps.
 const usr = Buffer.alloc(4 + 16 + 16 + 12 + 64 + 8 * 128 + 4 * 128); usr.writeUInt32LE(0x12d5819a, 0); usr.writeUInt32LE(0b101, 4);
 usr.writeBigUInt64LE(1700000000n, 4 + 16 + 16 + 12 + 64 + 8 * 2);
 const p = parseVita3KProgress(usr); assert.deepEqual([...p.unlocked], [0, 2]); assert.equal(p.times.get(2), 1700000000);
 const pref = path.join(root, 'Vita3K'), game = path.join(pref, 'ux0', 'app', 'PCSE00001');
 file(game, 'eboot.bin', 'x'); file(game, 'sce_sys/trophy/NPWR00001_00/TROPHY.TRP', 'x');
 const conf = path.join(pref, 'ux0', 'user', '00', 'trophy', 'conf', 'NPWR00001_00');
 file(conf, 'TROPCONF.SFM', '<trophyconf><title-name>Vita Game</title-name><trophy id="000" ttype="B"><name>First</name><detail>d</detail></trophy><trophy id="001" ttype="S"><name>Second</name><detail>d</detail></trophy><trophy id="002" ttype="G"><name>Third</name><detail>d</detail></trophy></trophyconf>');
 file(path.join(pref, 'ux0', 'user', '00', 'trophy', 'data', 'NPWR00001_00'), 'TROPUSR.DAT', usr);
 const vita = readVita3K({path: path.join(game, 'eboot.bin')}, {vita3kRoot: pref, language: 'en'}, path.join(root, 'data'));
 assert.equal(vita.status, 'ok'); assert.equal(vita.total, 3); assert.equal(vita.unlocked, 2); assert.equal(vita.achievements[2].date, 1700000000);
 // shadPS4: definições no diretório trophy e progresso por usuário em home.
 const user = path.join(root, 'shad', 'user'), ps4 = path.join(root, 'games', 'CUSA00001');
 file(ps4, 'eboot.bin', 'x'); file(ps4, 'sce_sys/npbind.dat', Buffer.from('\0\0NPWR12345_00\0', 'latin1'));
 file(user, 'trophy/NPWR12345_00/Xml/TROP.XML', '<trophyconf version="1.1" platform="ps4"><trophy id="0" ttype="P"><name>Platinum</name><detail>All</detail></trophy><trophy id="1" ttype="B"><name>Start</name><detail>Begin</detail></trophy></trophyconf>');
 file(user, 'home/1000/trophy/NPWR12345_00.xml', '<trophyconf><trophy id="1" unlockstate="true" timestamp="1700000001"></trophy></trophyconf>');
 const shad = readShadPS4({path: path.join(ps4, 'eboot.bin')}, {shadps4Root: user, language: 'en'}, path.join(root, 'data'));
 assert.equal(shad.status, 'ok'); assert.equal(shad.unlocked, 1); assert.equal(shad.achievements[1].date, 1700000001);
 assert.equal(parsePS4Unlocks('<trophy id="3" unlockstate="false"/>').size, 0);
 assert.equal(trophyTime(63845000000000000), Math.round(63845000000000000 / 1e6 - 62135596800));
});

test('Lojas instaladas: Epic (manifesto) e GOG (goggame.info) viram candidatos sem executar nada', t => {
 const root = temp(t), programData = path.join(root, 'ProgramData');
 const epicGame = path.join(root, 'Epic', 'Hades'); file(epicGame, 'Hades.exe', 'MZ');
 file(programData, 'Epic/EpicGamesLauncher/Data/Manifests/a.item', JSON.stringify({DisplayName: 'Hades', InstallLocation: epicGame, LaunchExecutable: 'Hades.exe', CatalogNamespace: 'ns', CatalogItemId: 'item', AppName: 'Min', MainGameAppName: 'Min', bIsManaged: false}));
 file(programData, 'Epic/EpicGamesLauncher/Data/Manifests/dlc.item', JSON.stringify({DisplayName: 'Hades DLC', InstallLocation: epicGame, LaunchExecutable: 'Hades.exe', CatalogNamespace: 'ns', CatalogItemId: 'dlc', AppName: 'Dlc', MainGameAppName: 'Min'}));
 const epic = scanEpic({PROGRAMDATA: programData});
 assert.equal(epic.length, 1); assert.equal(epic[0].title, 'Hades'); assert.match(epic[0].url, /^com\.epicgames\.launcher:\/\/apps\/ns%3Aitem%3AMin/);
 const lib = path.join(root, 'GOG Games'), gog = path.join(lib, 'Celeste'); file(gog, 'Celeste.exe', 'MZ');
 file(gog, 'goggame-1234.info', JSON.stringify({gameId: '1234', name: 'Celeste', playTasks: [{isPrimary: true, type: 'FileTask', path: 'Celeste.exe', category: 'game'}]}));
 file(programData, 'GOG.com/Galaxy/config.json', JSON.stringify({installationPaths: [lib]}));
 const g = scanGOG({PROGRAMDATA: programData});
 assert.equal(g.length, 1); assert.equal(g[0].path, path.join(gog, 'Celeste.exe'));
 assert.deepEqual(launchFor({title: 'Hades', profile: 'store', path: path.join(epicGame, 'Hades.exe'), launch: {exe: process.execPath, args: epic[0].url}}, {}, ''), {exe: process.execPath, args: '"' + epic[0].url + '"'});
 assert.throws(() => launchFor({title: 'x', profile: 'store', path: 'x', launch: {exe: process.execPath, args: 'https://evil.example'}}, {}, ''), /Link da loja inválido/);
});

test('Jogos de PC: steam_appid.txt e nomes da pasta/executável viram candidatos', t => {
 const root = temp(t), dir = path.join(root, 'Hollow Knight [FitGirl Repack]');
 file(dir, 'steam_appid.txt', '367520'); const exe = file(dir, 'hollow_knight.exe', 'MZ');
 assert.equal(steamAppIdNear(exe, dir), 367520);
 assert.deepEqual(pcNames({path: exe, suggestedRoot: dir}), ['Hollow Knight']);
});

test('Importação end-to-end: pasta PS2 identificada pelo banco de dumps sem diálogo e sem chaves', async t => {
 const root = temp(t), dataDir = path.join(root, 'data');
 const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(100)]);
 const game = file(root, 'Jogos/PS2/qualquer nome.iso', isoWith([['SYSTEM.CNF', Buffer.from('BOOT2 = cdrom0:\\SLUS_209.46;1\r\n')], ['SLUS_209.46', elf]]));
 let searched = 0;
 const factory = (c, d) => { const p = new Providers(c, d, {offline: true}); p.dat = new DatIndex({dir: d, fetchText: async () => DAT}); p.raGameId = async () => null; p.candidates = async () => { searched++; return {igdb: [], sgdb: [], ra: [], errors: []}; }; p.enrich = async () => []; p.completeMissing = async () => []; p.cachedAchievements = () => null; return p; };
 const {server} = createApp({dataDir, port: 48940, providersFactory: factory}); await new Promise(r => server.listen(48940, '127.0.0.1', r)); t.after(() => new Promise(r => server.close(r)));
 const token = JSON.parse(fs.readFileSync(path.join(dataDir, 'config.json'))).adminToken;
 const api = async (route, body, status = 200) => { const r = await fetch('http://127.0.0.1:48940/api/' + route, {method: body === undefined ? 'GET' : 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)}); const v = await r.json(); assert.equal(r.status, status, JSON.stringify(v)); return v; };
 const scan = await api('scan', {paths: [path.join(root, 'Jogos')]});
 assert.equal(scan.items[0].platformKey, 'ps2');
 const resolved = await api('import-resolve', {scanId: scan.scanId});
 const item = resolved.items[0];
 assert.equal(item.automatic, true); assert.equal(item.title, 'Grand Theft Auto: San Andreas'); assert.equal(searched, 0);
 assert.equal(item.identificationReason, 'Código do jogo conferido no banco Redump/No-Intro');
 await api('import-confirm', {scanId: scan.scanId, items: [item]});
 const state = await api('state'), g = state.games[0];
 assert.equal(g.title, 'Grand Theft Auto: San Andreas'); assert.equal(g.platformName, 'PlayStation 2'); assert.equal(g.platformShort, 'PS2'); assert.equal(g.serial, 'SLUS-20946');
 assert.equal(g.canonicalName, 'Grand Theft Auto - San Andreas (USA) (v1.03)');
 assert.ok(state.settings.platforms.some(p => p.key === 'ps2' && p.short === 'PS2'));
 assert.equal(fs.existsSync(game), true);
 const feed = await api('game-feed?id=' + g.id); assert.ok(feed.addedAt);
});

// 2.3.11: ports com tela de configurações abrem direto no jogo; emuladores abrem em tela cheia e fecham junto com o jogo.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {directPlay} from '../lib/port-launch.mjs';import {detectedArguments} from '../lib/emulator-registry.mjs';
const w=s=>Buffer.from(s+'\0','utf16le');
test('Port launcher "Play ..." next to the game: the game opens directly with the same argument', t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taiga-play-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const game=path.join(dir,'God of War III.exe');fs.writeFileSync(game,Buffer.from('MZ'+'\0'.repeat(100)));
 assert.equal(directPlay(game),null,'sem iniciador');
 fs.writeFileSync(path.join(dir,'Play God of War III.exe'),Buffer.concat([Buffer.from('MZ'),Buffer.alloc(64),w('%ls\\God of War III.exe'),w('"%ls" --play%ls%ls'),w('God of War III.exe was not found next to this file.')]));
 assert.equal(directPlay(game).args,'--play');
 fs.writeFileSync(path.join(dir,'Other.exe'),Buffer.from('MZ'+'\0'.repeat(100)));
 assert.equal(directPlay(path.join(dir,'Other.exe')),null,'iniciador de outro jogo não conta');
});
test('Emulators start in fullscreen and close with the game where the emulator supports it', () => {
 assert.match(detectedArguments('ps2','C:/e/pcsx2-qt.exe'),/-batch .*-fullscreen/);
 assert.match(detectedArguments('ps3','C:/e/rpcs3.exe'),/--no-gui/);
 assert.match(detectedArguments('xenia','C:/e/xenia_canary.exe'),/--fullscreen=true/);
 assert.equal(detectedArguments('mgba','C:/e/mGBA.exe'),'-f "{game}"');
 assert.equal(detectedArguments('mgba','C:/e/visualboyadvance-m.exe'),'"{game}"');
 assert.equal(detectedArguments('melonds','C:/e/DeSmuME_x64.exe'),'"{game}"');
 assert.match(detectedArguments('dolphin','C:/e/Dolphin.exe'),/--batch/);
});

// Gera o .zip da Release: a pasta do programa inteira (Electron + resources/app), sem chaves, testes,
// ferramentas, README nem arquivos de desenvolvimento. Uso: node tools/package-release.mjs [pasta-de-saida]
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildPortablePackage} from '../resources/app/lib/portable-package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'resources/app/package.json'), 'utf8')).version;
if (!fs.existsSync(path.join(root, 'Taiga Launcher.exe'))) throw Error('Coloque os arquivos do Electron (Taiga Launcher.exe e o resto) na raiz antes de gerar a Release. Veja docs/BUILD.md.');
const outDir = path.resolve(process.argv[2] || path.join(root, 'dist'));
fs.mkdirSync(outDir, {recursive: true});
const out = path.join(outDir, `Taiga Launcher ${version}.zip`);
await buildPortablePackage({installDir: root, out, keys: {}, version});
console.log(out);

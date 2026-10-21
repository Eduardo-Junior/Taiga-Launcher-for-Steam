// Descobre o nome certo de um jogo de PC a partir do .exe: nome do produto gravado no arquivo, pastas, nome do
// arquivo, siglas ("gow3" → God of War 3, "GTA V" → Grand Theft Auto V) e numerais romanos. O resultado vai
// para a busca da Steam e a pessoa só confirma.
import {scoreCandidate, normalizeTitle, compact} from './title-match.mjs';

const GENERIC = /^(?:bin|binaries|win64|win32|x64|x86|game|games|jogos|jogo|launcher|start|play|run|main|app|client|release|retail|steam|steamapps|common|content|engine|program files(?: \(x86\))?|programas|arquivos de programas|desktop|downloads|documents|documentos|users|usuarios|[a-z]:?)$/i;
const NOISE = /\b(?:windows|win64|win32|x64|x86|pc|repack|portable|gog|steam|epic|dx\d{1,2}|vulkan|setup|launcher|shipping|final|full|game|play|v?\d+(?:\.\d+){1,3}[a-z]?)\b/gi;
// Siglas comuns de séries; só servem de pista para a busca (a pessoa confirma o resultado).
export const ACRONYMS = {gta: 'Grand Theft Auto', rdr: 'Red Dead Redemption', gow: 'God of War', cod: 'Call of Duty', ac: "Assassin's Creed", mgs: 'Metal Gear Solid', nfs: 'Need for Speed', ff: 'Final Fantasy', re: 'Resident Evil', dmc: 'Devil May Cry', tlou: 'The Last of Us', mk: 'Mortal Kombat', sf: 'Street Fighter', kh: 'Kingdom Hearts', dbz: 'Dragon Ball Z', pes: 'Pro Evolution Soccer', fh: 'Forza Horizon', hzd: 'Horizon Zero Dawn', ds: 'Dark Souls', bf: 'Battlefield', hl: 'Half-Life', cs: 'Counter-Strike', sw: 'Star Wars', ffx: 'Final Fantasy X', ets: 'Euro Truck Simulator', ats: 'American Truck Simulator', tw: 'Total War', bg: "Baldur's Gate", dl: 'Dying Light', ror: 'Risk of Rain', poe: 'Path of Exile'};
const STOPS = new Set(['of', 'the', 'and', 'a', 'an', 'de', 'do', 'da', 'o', 'to']);
const ROMAN = {i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10};

export function cleanName(value) {
  let s = String(value || '').replace(/\.(exe|lnk|url)$/i, '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/[_.\-+]+/g, ' ');
  s = s.replace(/^(?:play|launch|start|run|iniciar|jogar|executar)\s+/i, '').replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
const tokens = v => normalizeTitle(v).split(' ').filter(Boolean).map(t => ROMAN[t] ? String(ROMAN[t]) : t);
// Iniciais de um nome: "God of War III" → ["gow3", "gw3"]; "Grand Theft Auto V" → ["gta5"].
export function initialisms(name) {
  const main = String(name).split(/[:\-–\u2014]/)[0];
  const t = tokens(main), out = new Set();
  const make = skip => t.filter(w => !(skip && STOPS.has(w))).map(w => /^\d+$/.test(w) ? w : w[0]).join('');
  out.add(make(false)); out.add(make(true));
  return [...out].filter(x => x.length >= 2);
}
// Expande uma sigla conhecida: "gow 3" → "God of War 3".
export function expand(name) {
  const t = normalizeTitle(name).split(' ');
  const head = t[0] && ACRONYMS[t[0].replace(/\d+$/, '')];
  if (!head) return '';
  const num = t[0].match(/\d+$/)?.[0] || '';
  return [head, num, ...t.slice(1)].filter(Boolean).join(' ');
}
export function guessScore(query, candidate) {
  let best = scoreCandidate(query, candidate, {}).score || 0;
  const q = compact(query);
  if (q.length >= 2 && initialisms(candidate).includes(q)) best = Math.max(best, .9);
  const c = compact(candidate);
  if (q.length >= 5 && c.startsWith(q)) best = Math.max(best, .82);
  return best;
}
// Nomes possíveis, do mais confiável ao menos: produto do .exe, pastas acima dele, nome do arquivo.
export function guessNames(file, {productName = '', shortcutName = '', consoleTitle = ''} = {}) {
  const out = [], add = v => { const c = cleanName(v); if (c && c.length > 1 && !GENERIC.test(c) && !/^(?:game|application|launcher)$/i.test(c)) out.push(c); };
  if (consoleTitle) add(consoleTitle);
  if (productName) add(productName);
  if (shortcutName) add(shortcutName);
  const parts = String(file).split(/[\\/]+/).filter(Boolean), base = parts.pop() || '';
  for (let i = parts.length - 1, n = 0; i >= 0 && n < 3; i--) { if (GENERIC.test(parts[i]) || /^[a-z]:$/i.test(parts[i])) continue; add(parts[i]); n++; }
  add(base);
  const seen = new Set(), list = [];
  for (const n of out) { const k = normalizeTitle(n); if (!seen.has(k)) { seen.add(k); list.push(n); } }
  for (const n of [...list]) { const e = expand(n); if (e && !seen.has(normalizeTitle(e))) { seen.add(normalizeTitle(e)); list.push(e); } }
  return list;
}
// Busca na Steam com cada nome e escolhe o melhor resultado.
// Melhor nome para pesquisar: um nome completo (com espaço e palavras de verdade), não a sigla.
export function bestQuery(names) {
  return names.find(n => /\s/.test(n) && n.replace(/[^\p{L}]/gu, '').length >= 6) || names[0] || '';
}
export async function guessSteamGame(names, search, {maxQueries = 5} = {}) {
  const pool = new Map();
  const results = await Promise.all(names.slice(0, maxQueries).map(async q => { try { return (await search(q))?.items || []; } catch { return []; } }));
  for (const items of results) for (const it of items.slice(0, 10)) { if (!it?.appId) continue; if (!pool.has(it.appId)) pool.set(it.appId, {appId: Number(it.appId), name: it.name}); }
  const scored = [...pool.values()].map(c => ({...c, score: Math.max(0, ...names.map(n => guessScore(n, c.name)))})).sort((a, b) => b.score - a.score);
  const best = scored[0] && scored[0].score >= .6 ? scored[0] : null;
  return {best, candidates: scored.slice(0, 6), names, query: bestQuery(names)};
}

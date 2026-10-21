// Interpreta nomes de arquivos e pastas de jogos.
// Cobre as convenções No-Intro/Redump ("Nome (USA) (En,Fr) (Rev 1) (Disc 2)"),
// TOSEC/GoodTools ("[!]", "[b1]", "(1998)(Sony)"), seriais no nome
// ("[SLUS-20946]") e pastas de jogos de PC baixados por fora
// ("Game.Name.v1.2-CODEX", "[FitGirl Repack]", "Build 1234").
import path from 'node:path';

const REGIONS = {
 usa: 'USA', us: 'USA', u: 'USA', america: 'USA', 'north america': 'USA', ntsc: 'USA', 'ntsc u': 'USA',
 europe: 'Europe', eu: 'Europe', eur: 'Europe', e: 'Europe', pal: 'Europe', uk: 'Europe', australia: 'Europe', germany: 'Europe', france: 'Europe', spain: 'Europe', italy: 'Europe',
 japan: 'Japan', jp: 'Japan', jpn: 'Japan', j: 'Japan', 'ntsc j': 'Japan', asia: 'Asia', korea: 'Korea', china: 'China', taiwan: 'Taiwan', brazil: 'Brazil', br: 'Brazil', world: 'World', w: 'World',
};
const LANG = /^(?:en|ja|fr|de|es|it|nl|pt|sv|no|da|fi|zh|ko|pl|ru|ca|cs|el|hu|tr|ar|he)(?:-[a-z]{2,4})?$/i;
const SERIAL = /\b((?:SL|SC)[AEKPU][CDMS]|UL[AEJKUS][MSX]|UC[AEJKUS][MSX]|NP[A-Z]{2}|BL[AEJKU]S|BC[AEJKU]S|PCS[A-Z]|CUSA|PLAS)[-_ ]?(\d{3})\.?(\d{2})\b/i;
const EXTRA_TAGS = /^(?:!|a\d*|b\d*|c|f\d*|h\d*\w*|o\d*|p\d*|t\d*|tr\s.*|cr\s.*|hack|proto(?:type)?\s*\d*|beta\s*\d*|alpha|demo|sample|kiosk|unl|pirate|aftermarket|homebrew|virtual console|switch online|steam|gog|psn|eshop|ntsc|pal|mega play|ffe|en|j|u|e|bios|translated|t\+\w+.*)$/i;

export function serialFromText(text) {
 const m = String(text || '').match(SERIAL);
 return m ? normalizeSerial(m[1] + m[2] + m[3]) : '';
}
// SLUS_209.46, SLUS20946, SLUS-209.46 -> SLUS-20946. Códigos PSP/PS3/PS4/Vita também.
export function normalizeSerial(value) {
 const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
 const m = raw.match(/^([A-Z]{4})(\d{5})$/);
 return m ? m[1] + '-' + m[2] : raw;
}

// "Legend of Zelda, The - Ocarina" -> "The Legend of Zelda - Ocarina"
function fixArticle(title) {
 return title.replace(/^(.+?),\s*(The|A|An|Le|La|Les|L'|Der|Die|Das|El|Los|Las|O|Os|As)(\s*[-:].*)?$/i, (_, main, art, rest = '') => `${art}${/'$/.test(art) ? '' : ' '}${main}${rest}`);
}

export function parseRomName(input) {
 const base = path.basename(String(input || '')).replace(/\.(?:zip|7z|rar|gz)$/i, '');
 const ext = path.extname(base).slice(1).toLowerCase();
 const stem = /^[a-z0-9]{1,5}$/.test(ext) ? base.slice(0, -(ext.length + 1)) : base;
 const tags = [], regions = [], languages = [];
 let disc = null, revision = null, version = null, year = null;
 const serial = serialFromText(stem);
 let title = stem.replace(/\(([^()]*)\)|\[([^\]]*)\]/g, (all, paren, bracket) => {
  const inner = String(paren ?? bracket ?? '').trim();
  tags.push(inner);
  const lower = inner.toLowerCase();
  const discMatch = lower.match(/^(?:disc|disk|cd|dvd|side)\s*([0-9a-z]+)(?:\s*of\s*\d+)?$/);
  if (discMatch) { disc = /^\d+$/.test(discMatch[1]) ? Number(discMatch[1]) : discMatch[1].toUpperCase(); return ' '; }
  const rev = lower.match(/^rev(?:ision)?\s*([0-9a-z.]+)$/);
  if (rev) { revision = rev[1]; return ' '; }
  const ver = lower.match(/^v\s?(\d+(?:\.\d+)*[a-z]?)$/);
  if (ver) { version = ver[1]; return ' '; }
  if (/^(?:19[7-9]\d|20[0-4]\d)(?:-\d\d(?:-\d\d)?)?$/.test(lower)) { year = Number(lower.slice(0, 4)); return ' '; }
  const parts = lower.split(/\s*,\s*/);
  if (parts.every(p => REGIONS[p])) { for (const p of parts) regions.push(REGIONS[p]); return ' '; }
  if (parts.every(p => LANG.test(p))) { for (const p of parts) languages.push(p.slice(0, 2)); return ' '; }
  if (SERIAL.test(inner)) return ' ';
  if (EXTRA_TAGS.test(inner)) return ' ';
  // Edições e subtítulos ficam no título; o restante é etiqueta de dump.
  if (/\b(?:edition|edição|edicion|collection|remaster(?:ed)?|director'?s cut|goty|game of the year|complete|definitive|platinum|greatest hits|best|limited|deluxe)\b/i.test(inner)) return ' ';
  return ' ';
 });
 title = title.replace(/\s+/g, ' ').trim();
 // Nomes sem espaços: "Ape_Escape", "God.of.War" (mas mantém siglas como "F.E.A.R.").
 if (!/\s/.test(title) && /[._]/.test(title) && !/^(?:[A-Z]\.){2,}/.test(title)) title = title.replace(/[._]+/g, ' ');
 title = title.replace(/_/g, ' ').replace(/\s+-\s*$/, '').replace(/\s{2,}/g, ' ').trim();
 title = fixArticle(title);
 return {title: title || stem, raw: stem, ext, regions: [...new Set(regions)], languages: [...new Set(languages)], disc, revision, version, year, serial, tags};
}

// Pastas e executáveis de jogos de PC: remove grupos de cena, versões e lixo de instaladores.
const PC_NOISE_WORDS = '(?:fitgirl|dodi|elamigos|kaos|xatab|codex|cpy|plaza|skidrow|reloaded|razor1911|empress|flt|hoodlum|rune|tenoke|tinyiso|darksiders|gog|repack|multi\\d*|multilanguage|incl(?:uding)?|update|updates|dlcs?|all dlc|x64|x86|win64|win32|dx11|dx12|portable|setup|installer|crack(?:ed)?|fix|steam ?rip|build\\s*\\d+|\\d+\\s*dlcs?)';
const PC_NOISE = new RegExp('\\b' + PC_NOISE_WORDS + '\\b', 'gi'), PC_GROUP = new RegExp('^' + PC_NOISE_WORDS + '$', 'i');
export function cleanPCTitle(value) {
 let text = String(value || '');
 text = text.replace(/\.(?:exe|lnk|url|bat|cmd)$/i, '');
 text = text.replace(/[-_ ](?:Win(?:64|32)|Linux)[-_ ]Shipping$/i, '');
 text = text.replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ');
 text = text.replace(/\(([^)]*)\)/g, (all, inner) => /\b(?:19[89]\d|20[0-4]\d)\b|remake|remaster|edition|goty|cut|part|chapter|episode/i.test(inner) ? ' ' + inner + ' ' : ' ');
 // Versões antes de trocar pontos por espaços: "Game.v1.2.3-GRUPO", "Game Build 123".
 text = text.replace(/[ ._-]v\d+(?:[._]\d+)*[a-z]?\b/gi, ' ').replace(/[ ._-]build[ ._-]?\d+/gi, ' ');
 text = text.replace(/-([A-Za-z0-9]+)$/, (m, group) => PC_GROUP.test(group) || /^[A-Z0-9]{3,}$/.test(group) && !/\d{4}/.test(group) ? '' : m);
 if (!/\s/.test(text.trim()) && /[._]/.test(text)) text = text.replace(/[._]+/g, ' ');
 text = text.replace(PC_NOISE, ' ').replace(/[_]+/g, ' ').replace(/\s+-\s+$/, '').replace(/\s{2,}/g, ' ').trim();
 return text.replace(/^[-–\s]+|[-–\s]+$/g, '');
}
// "PS2 - God of War" ou "God of War [PS2]" dentro do nome do arquivo também indica plataforma.
export function platformHintFromName(name) {
 const m = String(name || '').match(/[[(]\s*(psp|ps1|psx|ps2|ps3|ps4|vita|gba|gbc|gb|nds|3ds|n64|snes|nes|gc|wii|wii u|switch|dreamcast|saturn|genesis|mega drive|xbox|xbox 360)\s*[\])]/i);
 return m ? m[1].toLowerCase() : '';
}

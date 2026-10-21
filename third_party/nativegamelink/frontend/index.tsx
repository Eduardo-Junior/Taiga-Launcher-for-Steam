import './steam/browser-protection-bootstrap';
import plugin from './runtime/app';
import { gdlText, loc, displayLanguage, localNumber, SPANISH_TRANSLATIONS } from './steam/localization';
import { OTHER_LANGUAGE_TRANSLATIONS } from './steam/custom-translations';
import { TAIGA_GDL_TEXT } from './steam/taiga-translations';
import { TAIGA_TOKEN_FALLBACKS } from './steam/taiga-token-fallbacks';
import { SPANISH_TOKEN_FALLBACKS } from './steam/token-fallbacks';

// Taiga Launcher: usado pelo teste de tradução (tests/ngl-i18n.test.mjs) para rodar o código real em todos os idiomas.
export const __taigaI18n = { gdlText, loc, displayLanguage, localNumber, tables: { taiga: TAIGA_GDL_TEXT, other: OTHER_LANGUAGE_TRANSLATIONS, spanish: SPANISH_TRANSLATIONS, tokens: TAIGA_TOKEN_FALLBACKS, spanishTokens: SPANISH_TOKEN_FALLBACKS } };

export default plugin;

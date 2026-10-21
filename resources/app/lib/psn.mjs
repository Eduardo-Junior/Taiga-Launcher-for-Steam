// Conta PlayStation (opcional): nomes oficiais dos troféus no idioma do programa e troféus já ganhos no console.
// Mesmo caminho do aplicativo PlayStation para celular e da biblioteca psn-api (MIT): o login acontece na página
// oficial da Sony, numa janela do programa; dela sai o "npsso", trocado por um token de acesso que só lê troféus.
const AUTH = 'https://ca.account.sony.com/api/authz/v3/oauth';
const CLIENT = '09515159-7237-4370-9b40-3806e67c0891';
const BASIC = 'Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=';
const REDIRECT = 'com.scee.psxandroid.scecompcall://redirect';
const SCOPE = 'psn:mobile.v2.core psn:clientapp';
const TROPHY = 'https://m.np.playstation.com/api/trophy';
export const PSN_LOGIN_URL = 'https://my.account.sony.com/';
const LANG = {'pt-BR': 'pt-BR', en: 'en-US', es: 'es-419', fr: 'fr-FR', de: 'de-DE'};

const tokens = raw => {
 if (!raw?.access_token) throw Error('A PlayStation não aceitou o login. Entre de novo.');
 const now = Date.now();
 return {access: raw.access_token, refresh: raw.refresh_token || '', expiresAt: now + (Number(raw.expires_in) || 3600) * 1000 - 60000, refreshExpiresAt: now + (Number(raw.refresh_token_expires_in) || 5184000) * 1000 - 60000};
};

export async function psnFromNpsso(npsso, {fetchImpl = (...a) => fetch(...a)} = {}) {
 if (!/^[A-Za-z0-9]{40,128}$/.test(String(npsso || ''))) throw Error('Login da PlayStation incompleto. Tente de novo.');
 const q = new URLSearchParams({access_type: 'offline', client_id: CLIENT, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE});
 const res = await fetchImpl(`${AUTH}/authorize?${q}`, {headers: {Cookie: 'npsso=' + npsso}, redirect: 'manual', signal: AbortSignal.timeout(20000)});
 const code = new URLSearchParams(String(res.headers.get('location') || '').split('redirect/')[1] || '').get('code');
 if (!code) throw Error('A PlayStation não aceitou o login. Entre de novo.');
 const t = await fetchImpl(`${AUTH}/token`, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', Authorization: BASIC}, body: new URLSearchParams({code, redirect_uri: REDIRECT, grant_type: 'authorization_code', token_format: 'jwt'}), signal: AbortSignal.timeout(20000)});
 return tokens(await t.json());
}

// Token válido (renova com o refresh token quando vence). save(next) grava o novo token.
export async function validPsn(auth, {save = () => {}, fetchImpl = (...a) => fetch(...a)} = {}) {
 if (!auth?.access) return null;
 if (Date.now() < auth.expiresAt) return auth;
 if (!auth.refresh || Date.now() > auth.refreshExpiresAt) return null;
 const t = await fetchImpl(`${AUTH}/token`, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded', Authorization: BASIC}, body: new URLSearchParams({refresh_token: auth.refresh, grant_type: 'refresh_token', token_format: 'jwt', scope: SCOPE}), signal: AbortSignal.timeout(20000)});
 const next = {...auth, ...tokens(await t.json())}; save(next); return next;
}

async function call(url, auth, {language = 'pt-BR', fetchImpl = (...a) => fetch(...a)} = {}) {
 const res = await fetchImpl(url, {headers: {Authorization: 'Bearer ' + auth.access, 'Accept-Language': LANG[language] || 'en-US'}, signal: AbortSignal.timeout(20000)});
 if (res.status === 404) return null;
 if (!res.ok) throw Error('PlayStation respondeu HTTP ' + res.status + '.');
 return res.json();
}

export async function psnProfile(auth, opts = {}) {
 try { const r = await call('https://dms.api.playstation.com/api/v1/devices/accounts/me', auth, opts); if (r?.accountId) return {accountId: String(r.accountId)}; } catch {}
 return {};
}

// Lista oficial de troféus de um conjunto (NPWR…) + os ganhos pela conta. PS4/PS3/Vita = "trophy", PS5 = "trophy2".
export async function psnTrophies(npwr, auth, {language = 'pt-BR', fetchImpl} = {}) {
 if (!/^NPWR\d{5}_\d{2}$/.test(String(npwr))) return null;
 for (const service of ['trophy', 'trophy2']) {
  const defs = await call(`${TROPHY}/v1/npCommunicationIds/${npwr}/trophyGroups/all/trophies?npServiceName=${service}`, auth, {language, fetchImpl});
  if (!defs?.trophies?.length) continue;
  let earned = null; try { earned = await call(`${TROPHY}/v1/users/me/npCommunicationIds/${npwr}/trophyGroups/all/trophies?npServiceName=${service}`, auth, {language, fetchImpl}); } catch {}
  const got = new Map((earned?.trophies || []).filter(t => t.earned).map(t => [Number(t.trophyId), t.earnedDateTime ? Math.floor(Date.parse(t.earnedDateTime) / 1000) : Math.floor(Date.now() / 1000)]));
  return {service, achievements: defs.trophies.map(t => ({id: String(t.trophyId), title: String(t.trophyName || ''), description: String(t.trophyDetail || ''), grade: {platinum: 'P', gold: 'G', silver: 'S', bronze: 'B'}[String(t.trophyType || '').toLowerCase()] || '', hidden: !!t.trophyHidden, iconUrl: /^https:\/\//.test(t.trophyIconUrl || '') ? t.trophyIconUrl : '', earnedAt: got.get(Number(t.trophyId)) || null}))};
 }
 return null;
}

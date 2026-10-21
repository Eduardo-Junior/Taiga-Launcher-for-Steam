// Login da Epic para ler as conquistas mesmo com o perfil privado, o mesmo caminho do SuccessStory
// (playnite-plugincommon/CommonPluginsStores/Epic/EpicApi.cs, MIT, Lacro59), do Heroic e do Legendary:
//  1. o usuário entra na página oficial da Epic (janela do Taiga Launcher);
//  2. a Epic devolve um código de autorização em /id/api/redirect;
//  3. o código vira um token OAuth (cliente do launcher, token_type eg1), renovado com o refresh_token.
// O token só é usado para ler as conquistas do próprio usuário no GraphQL do launcher. Nada é gravado na Epic.
export const EPIC_LOGIN_URL = 'https://www.epicgames.com/id/login?redirectUrl=' + encodeURIComponent('https://www.epicgames.com/id/api/redirect?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code');
export const EPIC_REDIRECT = /^https:\/\/www\.epicgames\.com\/id\/api\/redirect\b/;
const TOKEN_URL = 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token';
const BASIC = 'MzRhMDJjZjhmNDQxNGUyOWIxNTkyMTg3NmRhMzZmOWE6ZGFhZmJjY2M3Mzc3NDUwMzlkZmZlNTNkOTRmYzc2Y2Y=';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) EpicGamesLauncher';

// Texto da página /id/api/redirect → código de autorização.
export function authorizationCode(text) {
 try { const j = JSON.parse(String(text || '').trim()); if (typeof j?.authorizationCode === 'string' && /^[0-9a-f]{32}$/i.test(j.authorizationCode)) return j.authorizationCode; } catch {}
 const m = String(text || '').match(/"authorizationCode"\s*:\s*"([0-9a-f]{32})"/i); return m ? m[1] : null;
}
function session(r) {
 if (!r?.access_token || !/^[0-9a-f]{32}$/i.test(String(r.account_id || ''))) throw Error('A Epic não devolveu uma sessão válida.');
 const now = Date.now();
 return {accountId: String(r.account_id).toLowerCase(), displayName: String(r.displayName || ''), type: String(r.token_type || 'bearer'), accessToken: r.access_token,
  expiresAt: r.expires_at ? Date.parse(r.expires_at) : now + (Number(r.expires_in) || 7200) * 1000,
  refreshToken: r.refresh_token || '', refreshExpiresAt: r.refresh_expires_at ? Date.parse(r.refresh_expires_at) : now + (Number(r.refresh_expires) || 0) * 1000};
}
async function token(body, fetchImpl) {
 const res = await fetchImpl(TOKEN_URL, {method: 'POST', headers: {Authorization: 'basic ' + BASIC, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA}, body: new URLSearchParams(body).toString(), signal: AbortSignal.timeout(20000)});
 const text = await res.text(); let data = null; try { data = JSON.parse(text); } catch {}
 if (!res.ok) throw Error(data?.errorMessage || 'A Epic recusou o login (HTTP ' + res.status + ').');
 return session(data);
}
export const exchangeCode = (code, fetchImpl = (...a) => fetch(...a)) => token({grant_type: 'authorization_code', code, token_type: 'eg1'}, fetchImpl);
export const refreshSession = (refreshToken, fetchImpl = (...a) => fetch(...a)) => token({grant_type: 'refresh_token', refresh_token: refreshToken, token_type: 'eg1'}, fetchImpl);

// Sessão válida (renova quando falta menos de 5 min). Devolve null quando é preciso entrar de novo.
export async function validSession(auth, {fetchImpl, save = () => {}} = {}) {
 if (!auth?.accessToken) return null;
 if (Date.now() < Number(auth.expiresAt) - 300000) return auth;
 if (!auth.refreshToken || (auth.refreshExpiresAt && Date.now() > Number(auth.refreshExpiresAt))) return null;
 try { const next = await refreshSession(auth.refreshToken, fetchImpl); save(next); return next; } catch { return null; }
}

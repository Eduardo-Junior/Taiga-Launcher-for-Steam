// Taiga Launcher: integração do NativeGameLink com o Taiga Launcher (arquivo adicionado pelo Taiga Launcher).
// Jogos de emulador usam AppIDs virtuais (1.900.000.000–1.999.999.999); para eles não existem páginas,
// comunidade ou loja da Steam. O catálogo abaixo é enviado pelo programa quando injeta a página.
export interface TaigaLink { label: string; url: string }
export interface TaigaCatalog { links?: Record<string, TaigaLink[]>; artLocked?: string[]; language?: string }
export function isTaigaVirtualAppId(id: unknown): boolean {
	const n = Number(id);
	return Number.isInteger(n) && n >= 1900000000 && n <= 1999999999;
}
export function taigaCatalog(): TaigaCatalog {
	try { return ((window as any).__TAIGA_CATALOG__ || {}) as TaigaCatalog; } catch { return {}; }
}
export function taigaLinksFor(appId: unknown): TaigaLink[] {
	const list = taigaCatalog().links?.[String(appId)];
	return Array.isArray(list) ? list.filter(l => l && /^https:\/\//.test(String(l.url || ''))) : [];
}
/** Artes de atalhos do Taiga Launcher são escolhidas pelo programa; o NGL não as troca sozinho. */
export function taigaArtworkLocked(shortcutAppId: unknown): boolean {
	const id = String(Number(shortcutAppId) >>> 0);
	return Boolean(taigaCatalog().artLocked?.includes(id));
}

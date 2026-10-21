import { backendLog } from '../../../api/backend';
import { gdlText } from '../../localization';
import { steamGameMainPageUrl } from '../../../core/steam-links';
import { isTaigaVirtualAppId, taigaLinksFor } from '../../../core/taiga';

export interface SteamDesktopLinkItem {
	strLabel: string;
	strURL: string;
	key?: string;
	bExternal?: boolean;
}

export interface SteamDesktopLinksShape {
	nAppID: number;
	rgLinks: SteamDesktopLinkItem[];
	bIsDelisted?: boolean;
	bHasWorkshop?: boolean;
	bHasDlc?: boolean;
	onNavigate?: (url: string) => void;
}

export interface PrimaryLinksAdapterOptions {
	steamAppId: string | number;
	isDelisted?: boolean;
	hasWorkshop: boolean;
	hasDlc?: boolean;
	onCustomNavigate?: (url: string) => void;
}

export function toSteamDesktopLinks(
	options: PrimaryLinksAdapterOptions,
): SteamDesktopLinksShape {
	const numericAppId = Number(options.steamAppId) || 0;
	const appIdStr = String(options.steamAppId);
	// Taiga Launcher: jogos de emulador não têm páginas da Steam; mostrar só os links do jogo.
	if (isTaigaVirtualAppId(appIdStr)) {
		return {
			nAppID: numericAppId,
			rgLinks: taigaLinksFor(appIdStr).map((link, index) => ({ key: 'taiga_' + index, strLabel: link.label, strURL: link.url, bExternal: true })),
			bIsDelisted: false, bHasWorkshop: false, bHasDlc: false,
			onNavigate: (url: string) => { try { (window as any).SteamClient?.System?.OpenInSystemBrowser?.(url); } catch {} },
		};
	}

	const links: SteamDesktopLinkItem[] = [
		{
			key: 'store',
			strLabel: gdlText('store_page', 'Store page'),
			strURL: steamGameMainPageUrl(appIdStr, options.isDelisted),
		},
	];

	if (options.hasDlc) {
		links.push({
			key: 'dlc',
			strLabel: gdlText('dlc_links', 'DLC'),
			strURL: `https://store.steampowered.com/dlc/${appIdStr}/`,
		});
	}

	links.push(
		{
			key: 'community',
			strLabel: gdlText('community_hub', 'Community hub'),
			strURL: `https://steamcommunity.com/app/${appIdStr}`,
		},
		{
			key: 'points_shop',
			strLabel: gdlText('points_shop', 'Points shop'),
			strURL: `https://store.steampowered.com/points/shop/app/${appIdStr}`,
		},
		{
			key: 'discussions',
			strLabel: gdlText('discussions', 'Discussions'),
			strURL: `https://steamcommunity.com/app/${appIdStr}/discussions/`,
		},
		{
			key: 'guides',
			strLabel: gdlText('guides', 'Guides'),
			strURL: `https://steamcommunity.com/app/${appIdStr}/guides/`,
		},
	);

	if (options.hasWorkshop) {
		links.push({
			key: 'workshop',
			strLabel: gdlText('workshop', 'Workshop'),
			strURL: `https://steamcommunity.com/app/${appIdStr}/workshop/`,
		});
	}

	links.push({
		key: 'support',
		strLabel: gdlText('support', 'Support'),
		strURL: `https://help.steampowered.com/wizard/HelpWithGame/?appid=${appIdStr}`,
	});

	return {
		nAppID: numericAppId,
		rgLinks: links,
		bIsDelisted: Boolean(options.isDelisted),
		bHasWorkshop: Boolean(options.hasWorkshop),
		bHasDlc: Boolean(options.hasDlc),
		onNavigate: (url: string) => {
			backendLog(`[NGL][Desktop][Links] Navigation requested: ${url}`);
			if (options.onCustomNavigate) {
				options.onCustomNavigate(url);
				return;
			}
			const overlay = (window as any)?.SteamClient?.Overlay;
			if (typeof overlay?.OpenURL === 'function') {
				try { overlay.OpenURL(url); return; } catch {}
			}
			const system = (window as any)?.SteamClient?.System;
			if (typeof system?.OpenInSystemBrowser === 'function') {
				try { system.OpenInSystemBrowser(url); return; } catch {}
			}
			if (typeof window !== 'undefined') {
				window.open(url, '_blank');
			}
		},
	};
}

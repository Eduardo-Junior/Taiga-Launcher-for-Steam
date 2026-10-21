import type { NewsItem } from '../../../domain/types';
import { localFeedLabel } from '../../../features/library/news';
import { gdlText } from '../../localization';

export interface SteamDesktopNewsShape {
	strTitle: string;
	strUrl: string;
	strAuthor: string;
	strContents: string;
	rtDate: number;
}

export function toSteamDesktopNews(item: NewsItem): SteamDesktopNewsShape {
	return {
		strTitle: item.title,
		strUrl: item.url,
		strAuthor: localFeedLabel(item.feedlabel) || gdlText('feed_news', 'News'),
		strContents: item.contents,
		rtDate: item.date,
	};
}

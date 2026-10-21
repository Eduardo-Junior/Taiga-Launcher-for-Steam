import { gdlText, steamIntlLocale, localNumber } from '../../steam/localization';

export function formatPlaytimeMinutes(minutes: number): string {
	// Taiga Launcher: menos de um minuto aparece como "1 min" (sem "< 1 min").
	if (!Number.isFinite(minutes) || minutes <= 0) return gdlText('playtime_minutes', '{count} min', { count: 1 });
	if (minutes < 60) return gdlText('playtime_minutes', '{count} min', { count: Math.max(1, Math.round(minutes)) });
	const hours = localNumber(minutes / 60, 1, true);
	return gdlText('playtime_hours', '{count} h', { count: hours });
}

// Taiga Launcher: "hoje", "ontem" e "há N dias" no idioma escolhido (Intl), em vez de textos fixos em inglês.
function relativeDay(days: number, fallback: string): string {
	try {
		const text = new Intl.RelativeTimeFormat(steamIntlLocale(), { numeric: 'auto' }).format(-days, 'day');
		return text ? text.charAt(0).toLocaleUpperCase(steamIntlLocale()) + text.slice(1) : fallback;
	} catch { return fallback; }
}

export function formatLastPlayedDate(timestampSeconds: number): string {
	if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) return '';
	const date = new Date(timestampSeconds * 1000);
	const now = new Date();

	const isToday = date.getFullYear() === now.getFullYear()
		&& date.getMonth() === now.getMonth()
		&& date.getDate() === now.getDate();
	if (isToday) return relativeDay(0, gdlText('last_played_today', 'Today'));

	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const isYesterday = date.getFullYear() === yesterday.getFullYear()
		&& date.getMonth() === yesterday.getMonth()
		&& date.getDate() === yesterday.getDate();
	if (isYesterday) return relativeDay(1, gdlText('last_played_yesterday', 'Yesterday'));

	const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
	if (diffDays >= 2 && diffDays <= 6) {
		return relativeDay(diffDays, gdlText('last_played_days_ago', '{count} days ago', { count: diffDays }));
	}

	try {
		const formatter = new Intl.DateTimeFormat(steamIntlLocale(), {
			day: 'numeric',
			month: 'short',
			year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
		});
		return formatter.format(date);
	} catch {
		return date.toLocaleDateString();
	}
}

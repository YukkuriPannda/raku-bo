import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const calendarEvents = new Hono<{ Bindings: Env; Variables: Variables }>();

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  error?: { message: string };
}

/**
 * GET /calendar-events?month=YYYY-MM
 * Authorization: Bearer {supabase_jwt}
 * X-Google-Access-Token: {google_access_token}
 *
 * Googleカレンダーから当月のイベントを全件返す（キーワードフィルタなし）。
 * 予定された支出のカレンダー連動登録に使用する。
 */
calendarEvents.get('/', async (c) => {
  const googleAccessToken = c.req.header('X-Google-Access-Token');
  if (!googleAccessToken) {
    return c.json(
      { error: 'Google Access Token が必要です（X-Google-Access-Token ヘッダ）' },
      400,
    );
  }

  const monthParam = c.req.query('month');
  let year: number;
  let month: number;

  if (monthParam) {
    const parts = monthParam.split('-');
    if (parts.length !== 2) {
      return c.json({ error: 'month パラメータは YYYY-MM 形式で指定してください' }, 400);
    }
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
  } else {
    const now = new Date();
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }

  const timeMin = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const timeMax = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00Z`;

  try {
    const calendarUrl = new URL(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
    calendarUrl.searchParams.set('timeMin', timeMin);
    calendarUrl.searchParams.set('timeMax', timeMax);
    calendarUrl.searchParams.set('singleEvents', 'true');
    calendarUrl.searchParams.set('orderBy', 'startTime');
    calendarUrl.searchParams.set('maxResults', '250');

    const response = await fetch(calendarUrl.toString(), {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as GoogleCalendarEventsResponse;
      console.error('Google Calendar API エラー:', errorData);
      return c.json(
        { error: `Google Calendar API エラー: ${errorData.error?.message ?? response.statusText}` },
        response.status as 400 | 401 | 403 | 404 | 500,
      );
    }

    const data = (await response.json()) as GoogleCalendarEventsResponse;
    const events = data.items ?? [];

    const result = events.map((event) => {
      const startRaw = event.start?.dateTime ?? event.start?.date ?? '';
      const endRaw = event.end?.dateTime ?? event.end?.date ?? '';
      // 終日イベントは date のみ（時刻なし）なので date をそのまま使う
      const date = event.start?.date ?? (startRaw ? startRaw.slice(0, 10) : '');
      return {
        id: event.id,
        title: event.summary ?? '',
        start: startRaw,
        end: endRaw,
        date,
      };
    });

    return c.json(result);
  } catch (error) {
    console.error('カレンダーイベント取得エラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

export default calendarEvents;

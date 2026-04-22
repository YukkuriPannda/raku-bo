import { Hono } from 'hono';
import type { Env, Variables } from '../types';

const shifts = new Hono<{ Bindings: Env; Variables: Variables }>();

/** シフトと判断するキーワード */
const SHIFT_KEYWORDS = ['バイト', 'シフト', '出勤', '勤務'];

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  description?: string;
}

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  error?: { message: string };
}

/**
 * GET /shifts?month=2026-04
 * Authorization: Bearer {supabase_jwt}
 * X-Google-Access-Token: {google_access_token}
 *
 * Google Calendar API を呼び出し、タイトルにシフト関連キーワードを含むイベントを返す。
 * Google Access Token は X-Google-Access-Token ヘッダから取得する。
 */
shifts.get('/', async (c) => {
  const monthParam = c.req.query('month');

  // Google Access Token の取得
  const googleAccessToken = c.req.header('X-Google-Access-Token');
  if (!googleAccessToken) {
    return c.json(
      { error: 'Google Access Token が必要です（X-Google-Access-Token ヘッダ）' },
      400,
    );
  }

  // month パラメータのパース（YYYY-MM 形式）
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

  // 月初・月末の ISO 8601 形式
  const timeMin = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const timeMax = `${endYear}-${String(endMonth).padStart(2, '0')}-01T00:00:00Z`;

  try {
    // Google Calendar API を呼び出す
    const calendarUrl = new URL(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    );
    calendarUrl.searchParams.set('timeMin', timeMin);
    calendarUrl.searchParams.set('timeMax', timeMax);
    calendarUrl.searchParams.set('singleEvents', 'true');
    calendarUrl.searchParams.set('orderBy', 'startTime');
    calendarUrl.searchParams.set('maxResults', '2500');

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

    // シフト関連キーワードを含むイベントのみフィルタリング
    const shiftEvents = events.filter((event) => {
      const title = event.summary ?? '';
      return SHIFT_KEYWORDS.some((keyword) => title.includes(keyword));
    });

    return c.json({
      month: `${year}-${String(month).padStart(2, '0')}`,
      shifts: shiftEvents.map((event) => ({
        id: event.id,
        title: event.summary ?? '',
        start: event.start?.dateTime ?? event.start?.date ?? null,
        end: event.end?.dateTime ?? event.end?.date ?? null,
        description: event.description ?? null,
      })),
    });
  } catch (error) {
    console.error('シフト取得エラー:', error);
    return c.json({ error: '内部サーバーエラー' }, 500);
  }
});

export default shifts;

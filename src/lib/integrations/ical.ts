import { createHmac, timingSafeEqual } from 'node:crypto';
import { addDays } from '@/lib/dates';

export type IcsEvent = { uid: string; start: string; end: string; summary: string; cancelled?: boolean };

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const compact = (d: string) => d.replaceAll('-', '');

function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

/** RFC 5545 all-day events. `end` is the exclusive checkout date. */
export function buildIcs(calendarName: string, events: IcsEvent[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Iliria//Hotel//SQ', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(calendarName)}`];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(e.end)}`,
      `SUMMARY:${esc(e.summary)}`,
      'TRANSP:OPAQUE',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

const toDate = (v: string) => {
  const m = v.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Minimal, tolerant VEVENT parser (Airbnb, Booking.com, Expedia, Google style feeds). */
export function parseIcs(text: string): IcsEvent[] {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const events: IcsEvent[] = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0] ?? '';
    const get = (name: string) => {
      const m = body.match(new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, 'im'));
      return m?.[1]?.trim() ?? '';
    };
    const start = toDate(get('DTSTART'));
    let end = toDate(get('DTEND'));
    const uid = get('UID');
    if (!start || !uid) continue;
    if (!end || end <= start) end = addDays(start, 1);
    events.push({
      uid,
      start,
      end,
      summary: get('SUMMARY').replace(/\\,/g, ',').replace(/\\n/g, ' ') || 'Reserved',
      cancelled: /^CANCELLED$/i.test(get('STATUS')),
    });
  }
  return events;
}

const key = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
export const signRoom = (roomId: string) => createHmac('sha256', key()).update(`ical:${roomId}`).digest('hex').slice(0, 24);
export function verifyRoomSig(roomId: string, sig: string) {
  const a = Buffer.from(signRoom(roomId));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Block SSRF: feeds must be public https URLs. */
export function assertPublicFeedUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('https only');
  const h = url.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === '::1' ||
    h.startsWith('[')
  ) {
    throw new Error('private host');
  }
  return url;
}

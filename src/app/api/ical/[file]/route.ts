import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, rooms } from '@/db/schema';
import { buildIcs, verifyRoomSig } from '@/lib/integrations/ical';

export const dynamic = 'force-dynamic';

/** Public per-room iCal feed for Booking.com / Airbnb / Expedia to import. Signed, no guest data. */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = file.match(/^([0-9a-f-]{36})\.([0-9a-f]{24})\.ics$/i);
  if (!m || !verifyRoomSig(m[1]!, m[2]!)) return new Response('Not found', { status: 404 });

  const [room] = await db.select({ id: rooms.id, orgId: rooms.orgId, number: rooms.number }).from(rooms).where(eq(rooms.id, m[1]!)).limit(1);
  if (!room) return new Response('Not found', { status: 404 });

  const rows = await db
    .select({ id: bookings.id, checkIn: bookings.checkIn, checkOut: bookings.checkOut })
    .from(bookings)
    .where(and(eq(bookings.orgId, room.orgId), eq(bookings.roomId, room.id), inArray(bookings.status, ['tentative', 'confirmed', 'checked_in'])));

  const ics = buildIcs(
    `Dhoma ${room.number}`,
    rows.map((b) => ({ uid: `${b.id}@iliria`, start: b.checkIn, end: b.checkOut, summary: 'Rezervuar' })),
  );
  return new Response(ics, {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

import { after, NextResponse, type NextRequest } from 'next/server';
import { pullChannex } from '@/server/services/channex-sync';

// Channex webhook → URL: https://YOUR_DOMAIN/api/channels/channex/webhook?token=CHANNEX_WEBHOOK_SECRET
// The payload is only a trigger; the booking itself is always read from the authenticated feed.
export async function POST(req: NextRequest) {
  const secret = process.env.CHANNEX_WEBHOOK_SECRET;
  if (!secret || req.nextUrl.searchParams.get('token') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  after(async () => {
    try {
      await pullChannex();
    } catch (e) {
      console.error('[channels] webhook pull', e);
    }
  });
  return NextResponse.json({ ok: true });
}

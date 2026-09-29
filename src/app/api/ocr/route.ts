import { z } from 'zod';
import { aiConfigured } from '@/lib/ai/openrouter';
import { takeAiBudget } from '@/lib/ai/budget';
import { extractPassport, extractReceipt } from '@/lib/ai/ocr';
import { requireOrg } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const body = z.object({
  kind: z.enum(['receipt', 'passport']),
  image: z.string().startsWith('data:image/').max(7_000_000),
});

const ROLES: Record<'receipt' | 'passport', string[]> = {
  receipt: ['owner', 'manager', 'accountant'],
  passport: ['owner', 'manager', 'receptionist'],
};

/** Vision OCR for receipts (saved to the private `receipts` bucket) and passports (never stored). */
export async function POST(request: Request) {
  const ctx = await requireOrg();
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const { kind, image } = parsed.data;

  const moduleOk = kind === 'receipt' ? ctx.modules.has('expenses') : ctx.modules.has('pms');
  if (!moduleOk || (!ROLES[kind].includes(ctx.role) && !ctx.profile.isSuperAdmin)) return Response.json({ error: 'forbidden' }, { status: 403 });
  if (!aiConfigured()) return Response.json({ error: 'ai_off' }, { status: 503 });
  if (!(await takeAiBudget(ctx.org.id, ctx.user.id, `ocr_${kind}`, 60))) return Response.json({ error: 'limit' }, { status: 429 });

  try {
    if (kind === 'passport') {
      const data = await extractPassport(image);
      return Response.json({ data });
    }
    const data = await extractReceipt(image);
    let receiptPath: string | null = null;
    try {
      const mime = image.slice(5, image.indexOf(';'));
      const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
      const path = `${ctx.org.id}/${crypto.randomUUID()}.${ext}`;
      const buf = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
      const { error } = await createAdminClient().storage.from('receipts').upload(path, buf, { contentType: mime, upsert: false });
      if (!error) receiptPath = path;
    } catch (e) {
      console.error('[ocr-upload]', e);
    }
    return Response.json({ data, receiptPath });
  } catch (e) {
    console.error('[ocr]', e);
    return Response.json({ error: 'failed' }, { status: 502 });
  }
}

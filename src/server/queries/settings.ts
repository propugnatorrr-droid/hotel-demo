import 'server-only';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { memberships, profiles, roomTypes, rooms } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { env } from '@/lib/env';

export async function getSettings(ctx: OrgContext) {
  const orgId = ctx.org.id;
  const [types, roomRows, members] = await Promise.all([
    db.select().from(roomTypes).where(eq(roomTypes.orgId, orgId)).orderBy(asc(roomTypes.sortOrder), asc(roomTypes.code)),
    db.select().from(rooms).where(eq(rooms.orgId, orgId)).orderBy(asc(rooms.number)),
    db
      .select({ id: memberships.id, role: memberships.role, isActive: memberships.isActive, userId: memberships.userId, name: profiles.fullName, email: profiles.email })
      .from(memberships)
      .innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(eq(memberships.orgId, orgId))
      .orderBy(asc(profiles.fullName)),
  ]);
  const o = ctx.org;
  const s = o.settings as Record<string, string | number | null | undefined>;
  return {
    profile: {
      name: o.name, legalName: o.legalName ?? '', nipt: o.nipt ?? '', address: o.address ?? '', city: o.city ?? '', phone: o.phone ?? '', email: o.email ?? '', website: o.website ?? '',
      coverImageUrl: o.coverImageUrl ?? '', currency: o.currency, defaultLocale: o.defaultLocale === 'en' ? 'en' : 'sq',
      checkInTime: String(s.checkInTime ?? '14:00'), checkOutTime: String(s.checkOutTime ?? '11:00'), reviewLink: String(s.reviewLink ?? ''),
      fxAllPerEur: Number(s.fxAllPerEur ?? 100), ownerWhatsapp: String(s.ownerWhatsapp ?? ''), telegramChatId: String(s.telegramChatId ?? ''),
    },
    persona: { name: o.aiPersona?.name ?? '', tone: o.aiPersona?.tone ?? '', instructions: o.aiPersona?.instructions ?? '' },
    slug: o.slug,
    siteUrl: `${env.NEXT_PUBLIC_APP_URL}/r/${o.slug}`,
    plan: o.plan,
    types: types.map((t) => ({
      id: t.id, code: t.code, nameSq: t.name.sq, nameEn: t.name.en, descSq: t.description?.sq ?? '', descEn: t.description?.en ?? '', basePrice: t.basePrice, baseOccupancy: t.baseOccupancy,
      maxOccupancy: t.maxOccupancy, sizeSqm: t.sizeSqm, bedType: t.bedType ?? '', view: t.view ?? '', amenities: t.amenities.join(', '), images: t.images.join('\n'), isActive: t.isActive,
    })),
    rooms: roomRows.map((r) => ({ id: r.id, number: r.number, floor: r.floor, typeId: r.roomTypeId, isActive: r.isActive })),
    members: members.map((m) => ({ ...m, isSelf: m.userId === ctx.user.id })),
  };
}

export type SettingsData = Awaited<ReturnType<typeof getSettings>>;

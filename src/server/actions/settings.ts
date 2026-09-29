'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { memberships, organizations, profiles, roomTypes, rooms } from '@/db/schema';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, fail, gate, MANAGERS, run, type ActionResult } from './kit';

const emptyToNull = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export async function updateHotelProfile(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = z
      .object({
        name: z.string().trim().min(2).max(120),
        legalName: z.string().trim().max(160).optional(),
        nipt: z.string().trim().max(20).optional(),
        address: z.string().trim().max(200).optional(),
        city: z.string().trim().max(80).optional(),
        phone: z.string().trim().max(40).optional(),
        email: z.union([z.email().max(160), z.literal('')]).optional(),
        website: z.union([z.url().max(200), z.literal('')]).optional(),
        coverImageUrl: z.union([z.url().max(500), z.literal('')]).optional(),
        currency: z.enum(['ALL', 'EUR', 'USD']),
        defaultLocale: z.enum(['sq', 'en']),
        checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        reviewLink: z.union([z.url().max(500), z.literal('')]).optional(),
        fxAllPerEur: z.coerce.number().min(1).max(1000).optional(),
        ownerWhatsapp: z.string().trim().max(30).optional(),
        telegramChatId: z.string().trim().max(30).optional(),
      })
      .parse(input);

    const settings = { ...ctx.org.settings, checkInTime: p.checkInTime ?? ctx.org.settings.checkInTime, checkOutTime: p.checkOutTime ?? ctx.org.settings.checkOutTime, reviewLink: emptyToNull(p.reviewLink), fxAllPerEur: p.fxAllPerEur ?? ctx.org.settings.fxAllPerEur, ownerWhatsapp: emptyToNull(p.ownerWhatsapp), telegramChatId: emptyToNull(p.telegramChatId) };
    await db
      .update(organizations)
      .set({ name: p.name, legalName: emptyToNull(p.legalName), nipt: emptyToNull(p.nipt), address: emptyToNull(p.address), city: emptyToNull(p.city), phone: emptyToNull(p.phone), email: emptyToNull(p.email), website: emptyToNull(p.website), coverImageUrl: emptyToNull(p.coverImageUrl), currency: p.currency, defaultLocale: p.defaultLocale, settings })
      .where(eq(organizations.id, ctx.org.id));
    await audit(db, ctx, 'settings.profile_updated', 'organization', ctx.org.id);
    return null;
  });
}

export async function updateAiPersona(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = z.object({ name: z.string().trim().min(2).max(40), tone: z.string().trim().min(3).max(160), instructions: z.string().trim().max(2500).optional() }).parse(input);
    await db.update(organizations).set({ aiPersona: { name: p.name, tone: p.tone, instructions: p.instructions || undefined } }).where(eq(organizations.id, ctx.org.id));
    await audit(db, ctx, 'settings.ai_persona_updated', 'organization', ctx.org.id);
    return null;
  });
}

const typeSchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().min(1).max(8).toUpperCase(),
  nameSq: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80),
  descSq: z.string().trim().max(400).optional(),
  descEn: z.string().trim().max(400).optional(),
  basePrice: z.coerce.number().min(0).max(100_000),
  baseOccupancy: z.coerce.number().int().min(1).max(12),
  maxOccupancy: z.coerce.number().int().min(1).max(12),
  sizeSqm: z.coerce.number().int().min(5).max(1000).optional(),
  bedType: z.string().trim().max(30).optional(),
  view: z.string().trim().max(30).optional(),
  amenities: z.string().trim().max(400).optional(),
  images: z.string().trim().max(2000).optional(),
  isActive: z.boolean().default(true),
});

export async function saveRoomType(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = typeSchema.parse(input);
    if (p.maxOccupancy < p.baseOccupancy) fail('invalid');
    const list = (s?: string) => (s ?? '').split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
    const images = list(p.images).filter((u) => /^https:\/\//.test(u)).slice(0, 12);
    const values = {
      code: p.code, name: { sq: p.nameSq, en: p.nameEn }, description: { sq: p.descSq ?? '', en: p.descEn ?? '' }, basePrice: p.basePrice, baseOccupancy: p.baseOccupancy,
      maxOccupancy: p.maxOccupancy, sizeSqm: p.sizeSqm ?? null, bedType: p.bedType || null, view: p.view || null, amenities: list(p.amenities), images, isActive: p.isActive,
    };
    if (p.id) {
      const [t] = await db.update(roomTypes).set(values).where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.id, p.id))).returning({ id: roomTypes.id });
      if (!t) fail('notFound');
      await audit(db, ctx, 'settings.room_type_saved', 'room_type', t.id);
      return { id: t.id };
    }
    const [t] = await db.insert(roomTypes).values({ orgId: ctx.org.id, ...values }).returning({ id: roomTypes.id });
    await audit(db, ctx, 'settings.room_type_saved', 'room_type', t!.id);
    return { id: t!.id };
  });
}

export async function addRoom(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = z.object({ roomTypeId: z.uuid(), number: z.string().trim().min(1).max(10), floor: z.coerce.number().int().min(-2).max(50).default(0) }).parse(input);
    const [t] = await db.select({ id: roomTypes.id }).from(roomTypes).where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.id, p.roomTypeId))).limit(1);
    if (!t) fail('type');
    await db.insert(rooms).values({ orgId: ctx.org.id, roomTypeId: t.id, number: p.number, floor: p.floor });
    await audit(db, ctx, 'settings.room_added', 'room', null, { number: p.number });
    return null;
  });
}

export async function setRoomActive(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = z.object({ roomId: z.uuid(), active: z.boolean() }).parse(input);
    const [r] = await db.update(rooms).set({ isActive: p.active }).where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, p.roomId))).returning({ id: rooms.id });
    if (!r) fail('notFound');
    await audit(db, ctx, p.active ? 'settings.room_activated' : 'settings.room_deactivated', 'room', r.id);
    return null;
  });
}

const ROLES = ['owner', 'manager', 'receptionist', 'housekeeping', 'pos', 'spa', 'accountant'] as const;

/** Invites a staff member by email (Supabase invite) and adds the membership. Only owners may grant owner/manager. */
export async function inviteStaff(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = z.object({ email: z.email().max(160), fullName: z.string().trim().min(2).max(100), role: z.enum(ROLES) }).parse(input);
    if (['owner', 'manager'].includes(p.role) && ctx.role !== 'owner' && !ctx.profile.isSuperAdmin) fail('forbidden');

    const admin = createAdminClient();
    let userId: string | undefined;
    const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, p.email.toLowerCase())).limit(1);
    if (existing) userId = existing.id;
    else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(p.email, { data: { full_name: p.fullName }, redirectTo: `${env.NEXT_PUBLIC_APP_URL}/login` });
      if (error || !data.user) fail('inviteFailed');
      userId = data.user.id;
      // Profile is created by the auth trigger; make sure it exists with the name.
      await db.insert(profiles).values({ id: userId, email: p.email.toLowerCase(), fullName: p.fullName }).onConflictDoNothing();
    }
    await db.insert(memberships).values({ orgId: ctx.org.id, userId: userId!, role: p.role }).onConflictDoUpdate({ target: [memberships.orgId, memberships.userId], set: { role: p.role, isActive: true } });
    await audit(db, ctx, 'team.invited', 'profile', userId!, { role: p.role });
    return null;
  });
}

export async function updateMember(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = z.object({ membershipId: z.uuid(), role: z.enum(ROLES).optional(), isActive: z.boolean().optional() }).parse(input);
    const [m] = await db.select().from(memberships).where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.id, p.membershipId))).limit(1);
    if (!m) fail('notFound');
    if (m.userId === ctx.user.id) fail('selfChange');
    if ((m.role === 'owner' || p.role === 'owner' || p.role === 'manager') && ctx.role !== 'owner' && !ctx.profile.isSuperAdmin) fail('forbidden');
    await db.update(memberships).set({ ...(p.role ? { role: p.role } : {}), ...(p.isActive !== undefined ? { isActive: p.isActive } : {}) }).where(eq(memberships.id, m.id));
    await audit(db, ctx, 'team.updated', 'profile', m.userId, { role: p.role, isActive: p.isActive });
    return null;
  });
}

# Iliria · Hotel platform (Albanian-first)

AI-first hotel/resort management: PMS, master calendar, channel manager (iCal + Channex), guest AI concierge,
unified inbox (WhatsApp/Instagram/Messenger), POS + spa, fiscalized invoicing, expenses with receipt OCR,
owner AI ("Pyet hotelin"), reports, voice assistant, super-admin console and a marketing site.
Full plan and decisions: [PLAN.md](PLAN.md).

## Quick start

```bash
npm install
cp .env.example .env.local     # fill Supabase + DATABASE_URL + OPENROUTER_API_KEY (see PLAN §17)
npm run db:push                # create tables
# run supabase/sql/*.sql in the Supabase SQL editor (RLS, storage, realtime, booking integrity)
npm run db:seed                # Vala Resort & Spa demo data
npm run dev
```

Demo logins: see the seed output (password = `DEMO_PASSWORD`).

## Verify without a database

```bash
npm run typecheck
npm run smoke      # in-memory Postgres (PGlite): schema, real seed, ~60 query/service/action checks
npm run build
```

## AI

Every AI feature goes through OpenRouter (`src/lib/ai/openrouter.ts`): staff assistant, guest concierge (web chat,
WhatsApp, Instagram, Messenger), owner AI, morning report, inbox reply drafts, receipt and passport OCR, voice tools.
Set `OPENROUTER_API_KEY`, optionally `OPENROUTER_MODEL` and `OPENROUTER_VISION_MODEL`. Empty key = features explain
that AI is off instead of failing.

## Integrations (mock → sandbox → live per hotel)

Adapters live in `src/lib/integrations`. Modes are set per hotel in **Channels** (`/app/channels`).
Live modes need their env keys. Vercel Cron (`vercel.json`) calls `/api/cron/sync` and `/api/cron/daily`
with `Authorization: Bearer $CRON_SECRET`.

## Safety notes

- Demo data: the GitHub "Database setup" workflow re-seeds and DELETES the Vala demo hotel. Never point it at a real hotel.
- Mock fiscal codes have no legal value. Real fiscalization needs the hotel's own certificate with a certified provider.
- `src/lib/integrations/fiscal.ts` and the Channex payload follow generic contracts and must be aligned with the
  provider docs when accounts are opened (they are unverified against live APIs).

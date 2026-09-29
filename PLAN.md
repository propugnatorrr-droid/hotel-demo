# PLAN.md: Master Plan (single source of truth)

> **For any AI assistant or developer picking this up:** read this whole file before writing code.
> Check the **Progress** section (§20) to see which batch is done, then continue with the next batch.
> Every decision below was agreed in the founders' chat (Sept 22–26, 2026) or in planning afterwards.
> If a decision changes, update this file in the same commit as the code change.

---

## 0. Quick facts

| Item | Value |
|---|---|
| Codename (repo) | `iliria` (placeholder; brand not final, see §4) |
| Product | AI-first hotel/resort management platform (PMS + channel manager + AI inbox + POS + invoicing + owner AI + voice AI) |
| First market | Albania: Tirana first, then the southern coast (where the real profit is) |
| Later markets | Other sectors (car rental, transport/taxi, law firms, clinics) under **separate brands**, plus EU (Italy first) for HR/accounting apps |
| Languages | Albanian (`sq`, default) + English (`en`). Designed Albanian-first. Italian later |
| Demo business | Fictional **Vala Resort & Spa, Dhërmi** (hotel + restaurant + bar + pool bar + spa) |
| Current phase | Phase 1: demo build, all integrations wired but running in **mock/sandbox** mode, **$0 spend** |
| Demo target | ~3 weeks from start of build |
| MVP target | 1 month = usable by a small business; 1–3 months = polished. Live before the 2027 season |

---

## 1. Team

| Person | Role |
|---|---|
| **Gerti** | Albania-based. 10 years in the Albanian hotel industry, knows existing systems. Sales, market knowledge, client pitches, local partners (fiscalization provider, lawyer), pricing strategy. Working with a lawyer on bringing the developer to Albania |
| **Klajdi (Cekin)** | Connected the team. Albanian. Ideas for separate HR and accounting apps (EU/Italy market). Can scaffold apps on Vercel |
| **Developer (repo owner)** | Builds everything: architecture, code, AI, integrations, design. Portfolio: citeward.com, prepsnext.com (/hub), celesya.com |

---

## 2. Vision

Build the best hotel management platform in Albania: **simpler than the competitors, more intelligent, beautifully designed, in Albanian**. It should pull every booking channel, every guest conversation, every sale and every invoice into one place, with an AI that runs guest communication and tells the owner everything about the business.

Key selling point (Gerti): **AI for the owner that tells them everything about their business, plus an AI that answers phone calls.**

Owners in Albania have money but aren't very tech-savvy, so **simplicity is a feature**.

---

## 3. Business model

### 3.1 Two models, one codebase
1. **Shared SaaS (small/medium hotels):** multi-tenant, each hotel gets its own account/login, monthly or annual subscription, features toggled per plan.
2. **Enterprise/custom (big hotels, resorts, groups):** **same codebase**, deployed to their own private server/project, with their branding and extra custom modules. **Big one-time fee + monthly maintenance.** They "own" their instance.
   - Deployed as a separate Vercel + Supabase project per client, or Docker on their own server if they insist.
   - Custom features for them live behind module flags, so the core never forks.

### 3.2 Pricing (not final; to be decided with Gerti)
- Gerti's market-entry proposal: **$400–500 per year** for the **first 50 hotels**, price **locked for 2 years**, raised in year 3.
- Developer's tier idea: **$20 / $50 / $100 per month** (Basic / Pro / Premium) based on features and business size.
- Custom/enterprise: **$5,000–20,000 one-time** + monthly maintenance.
- Payment from clients: **cash at first** (Albanian hesitation with card payments). Later: automated card billing.

### 3.3 Cost reality check (per hotel, if we pay for everything)
- Channex: $130/month platform fee + $7/hotel/month (only hotels with an active channel). Per hotel per year: ≈ $396 at 5 hotels, $162 at 20, $115 at 50, $100 at 100.
- Fiscalization provider: roughly $70–135/year per hotel (verify).
- AI + WhatsApp message costs: variable.
- **Decisions to protect margin:**
  - Hotels **pay their fiscalization provider directly** (they already need their own fiscal certificate).
  - **Real-time OTA sync = paid add-on** (e.g. +€10–15/month). Basic plan includes free iCal sync.
  - **Voice AI = paid add-on.**

### 3.4 Company and legal
- **NIPT** (Albanian business registration): open **near MVP**, not during development (avoid tax costs). Then get verified to issue invoices.
- **Partner agreement:** recommended now, in writing (roles, ownership, revenue split). Costs nothing, needs no NIPT.
- Hosting on Vercel's **Hobby (free) plan is non-commercial only**. Upgrade to Vercel Pro (~$20/month) + Supabase Pro (~$25/month) when the first real client pays.

---

## 4. Brand and positioning

- **Name: not final.** Candidates: *Iliria PMS*, *Elita PMS*, *Hoteli Im*, *Cekin Beats* (joke).
  - *Hoteli Im* was rejected by Gerti for a multi-sector brand, but we decided **each sector gets its own brand/site**, so a hotel-specific name is allowed for the hotel product.
  - Suggested structure: **one parent company name + product names** (e.g. "[Company] Hotel", later "[Company] Legal").
  - Klajdi: an English name with Albanian inspiration also works.
  - Brand name lives in `src/config/brand.ts`, so changing it is one edit.
- **Positioning (agreed):** an **Albanian company** built to give the Albanian market the very best, *"we're right here and not going anywhere."* Owners are frustrated with current providers' support, so we win on care.
- **Honesty rule:** no fake foreign history, no fake reviews, no fake client logos. Pitch: **"New Albanian company, founding price for the first 50 hotels."** (Fake track records can break consumer-protection law and destroy trust.)
- Marketing: active on social media, our website, everywhere online, collecting **real** reviews from pilot hotels.
- **Pitch rule for demos:** integrations run in mock/sandbox mode. Present them as *"how it works"*, not as live connections to Booking.com or the tax authority.

---

## 5. Market and competitors

- Albania has **3–4 competitors**. Main reference: **besa.al (BESA OS)**.
- **BESA OS offers (from its site, Sept 2026):** PMS, housekeeping, restaurant/bar/pool/room-service POS with room charge to the guest folio, spa and wellness, events/weddings/banquets, beach umbrellas and sunbeds map, agency/tour-operator contracts, HR (shifts, roles, payroll), inventory/stock/suppliers/purchasing, **fiscalization that works offline**, accounting under SKK 2, tax dossier/self-invoicing for Booking/Ads, treasury/cash/shifts, online payments/deposits/card guarantees, dynamic price optimization, RevPAR/ADR/occupancy dashboards, **AI for guest messages on WhatsApp/Instagram/Booking.com**, daily owner report, operational alerts, **built-in channel manager** (Booking.com, Expedia, Airbnb + OTA messages/reviews), booking engine, REST API, staging/training environment, multi-currency ALL/EUR/USD, guest app, owner app, staff app, 50+ modules, 8 apps. Positioned **premium/exclusive**, "private demo", no public prices. Has testimonials from hotels in Durrës. Tech partner: itdurres.com.
- **Conclusion:** BESA is strong, so "AI owner reports" alone is **not** a differentiator.
- **Where we win:**
  1. **Price and access:** transparent pricing, easy signup, fast onboarding (they're invitation-only).
  2. **AI voice receptionist** in Albanian and English (they don't advertise phone AI).
  3. **Deeper AI:** "Pyet hotelin" (ask anything in plain Albanian), AI booking inside the chat, passport OCR check-in on WhatsApp, receipt OCR, fraud/anomaly alerts, upsells, clear pricing suggestions.
  4. **Simplicity:** "Simple mode" for non-technical owners. 50+ modules is heavy for a 15-room hotel.
  5. **Custom builds** for big clients (they only sell a standard system).
  6. **Speed:** as a startup, we ship client requests fast.
  7. **Design:** far beyond anything local (see §13).
- **Our weak spots:** new brand, no reviews yet. Competitors are established.
- **Open task (Gerti):** get BESA's real prices and what owners complain about with them.

### 5.1 Open-source research (2026-09-28)
- **open-hotel-pms** (Next.js + Supabase, MIT): single-hotel, Thailand-specific, no AI/OTA/POS/fiscalization. Used for ideas only.
- **Kamra PMS** (Frappe, AGPL-3.0), **HotelDruid** (AGPL), **QloApps** (OSL-3.0): **never copy code**. Copyleft would force us to publish our SaaS source.
- **Pesan PMS** (Next.js, MIT): early stage, SQLite. Not useful.
- Conclusion: build our own. Ideas adopted → §7.14.

---

## 6. Scope decisions

- **Target now: hotels/resorts only** (hotel + bar + restaurant + spa inside one resort).
- Car rentals and taxi/transport share similar pain points (bookings, fleet/room management). **Same foundation later, separate brands.**
- **Text first, voice last.** Text messaging handles 90%+ of booking inquiries in Albania. Voice is expensive and slower to build, so it's added as the last module but is still part of the demo.
- The demo is **general** (fictional resort). When a real business signs, we personalize it for them (Klajdi's rule: don't waste time customizing before a client says yes).
- Build **English + Albanian** from day one (Gerti asked English first + 2 languages; we do both at once with i18n, designed Albanian-first).

---

## 7. Demo feature list (complete)

★ = not advertised on besa.al, so it's a selling point in pitches.

### 7.1 Platform foundation
- Multi-hotel system: each business gets its own account, login and fully separated data.
- Staff roles: Owner, Manager, Receptionist, Housekeeping, Bar/Restaurant (POS), Spa, Accountant. Each sees only what they need.
- Module switches: every feature ON/OFF per hotel, linked to Basic / Pro / Premium / Enterprise.
- Albanian and English, switchable anytime. The AI replies in the guest's language.
- ★ Super-admin panel for us: manage all client hotels, plans, payments (cash marked manually for now) and usage.
- ★ Simple mode: stripped-down view for non-technical owners with big buttons and only the essentials.

### 7.2 Front desk (PMS)
- Today dashboard: arrivals, departures, in-house guests, occupancy, revenue.
- Rooms and room types with photos, prices, floor and status.
- Create/edit/cancel bookings, including group bookings.
- Check-in / check-out flow.
- Guest profiles with visit history, preferences, notes and VIP tags.
- Guest folio: one bill per guest collecting room, bar, restaurant and spa charges.
- Housekeeping board: clean / dirty / inspected / out of order; tasks assigned to staff.
- Maintenance tickets for rooms.

### 7.3 Master calendar and channel manager
- Drag-and-drop calendar with all rooms and bookings, color-coded by source (Booking.com, Airbnb, Expedia, website, WhatsApp, walk-in, phone…).
- Prices and availability per day and per room type.
- Sync with Booking.com, Airbnb and Expedia through our **channel adapter** (Channex sandbox + iCal; mock data in the demo).
- Instant room blocking across all channels to prevent double bookings.
- Live updates: a booking made anywhere appears on every open screen immediately (Supabase Realtime).

### 7.4 Resort website and booking engine
- Modern resort website: rooms, restaurant, spa, gallery, location, contact.
- Direct booking with live availability (no OTA commission).
- Online payment or deposit (sandbox), or "pay at hotel".
- Spa treatments and restaurant tables bookable online.
- Albanian and English.

### 7.5 AI guest assistant (website chat)
- Answers any question about the resort 24/7, naturally, with its own name and personality.
- ★ Checks the live database: "Room 204 is free on the 2nd floor from Friday" / "We're full then, but a room opens on the 14th."
- ★ Books inside the chat: takes guest details, creates the booking, sends confirmation.
- Suggests upsells (spa package, dinner, late checkout, airport transfer).
- One-click handoff to a human.

### 7.6 Unified inbox and guest journey
- One inbox for WhatsApp, Instagram, Facebook Messenger and website chat (Meta test accounts in the demo).
- AI replies automatically. Staff can watch, take over or approve replies.
- Pre-arrival message: confirmation, directions, arrival time.
- ★ Contactless check-in on WhatsApp: guest sends a passport photo, AI reads it and fills in the guest profile.
- During the stay: AI concierge (Wi-Fi, breakfast hours, restaurant reservations, spa bookings, taxis).
- After checkout: thank-you, review request with a direct Google/Booking.com link, return-guest offer.
- Quick-reply templates in Albanian and English.

### 7.7 Restaurant, bar and spa (POS)
- POS screens for restaurant, bar, pool bar: menu, tables, orders.
- One-click charge to room (goes to the guest folio).
- Spa: treatment menu, therapist schedule, booking, charge to room.
- Simple stock tracking for bar/restaurant items with low-stock alerts.

### 7.8 Invoicing, fiscalization and payments
- Automatic invoices from each folio or POS sale.
- Fiscalization flow built for easyPos / fature.al: invoice gets **NIVF, NSLF and QR code** (mock in the demo, real API when live).
- Payments: cash, card, bank transfer. Deposits and split bills.
- Cash register and shift closing per staff member.
- ALL / EUR / USD.

### 7.9 Expenses and finance
- ★ AI receipt scanner: photo of a receipt → AI reads supplier, amount, VAT, category → logged.
- Expense tracking by department (rooms, restaurant, spa, maintenance).
- Profit overview: income minus expenses, per department and per month.

### 7.10 Owner AI (main selling point)
- ★ **"Pyet hotelin" (Ask your hotel):** owner types or sends a voice note in Albanian ("How much did the bar make this week?", "Who's arriving tomorrow?", "Which channel brings the most money?") and gets an instant answer.
- ★ Morning report on WhatsApp/Telegram: yesterday's revenue, occupancy, arrivals, problems.
- ★ Fraud and anomaly alerts: discounts outside the rules, cancelled invoices, cash differences at shift close, unusual refunds.
- Smart pricing suggestions ("Raise prices 15% for the weekend, demand is high"). BESA also has price optimization, so ours must be simpler and clearer.
- Key numbers (RevPAR, ADR, occupancy, top guests) explained in plain language.

### 7.11 AI voice receptionist (built last)
- ★ Answers phone calls in Albanian and English.
- Checks availability, makes bookings, answers questions, using the same data/tools as the chat AI.
- Transfers to staff when needed.
- Every call logged with a summary in the inbox.
- Runs on trial credits in the demo. **Test Albanian voice quality early** (Albanian is less supported by voice AI and may sound robotic).

### 7.12 Reports
- Occupancy, revenue, bookings by channel, cancellations.
- Restaurant, bar, spa sales.
- Staff activity log (who did what, when).
- Export to PDF / Excel.

### 7.13 NOT in the demo (later phases)
- Klajdi's separate **HR app** and **accounting app** (different sites/apps, EU market, mostly Italian companies that hire Albanian tax consultants/accountants; language auto-switches by visitor country; possibly a parent company holding multiple apps).
- Events and weddings, beach umbrella map, agency/tour-operator contracts.
- **Offline mode for fiscalization** (important in Albania; BESA advertises it, so it's on the roadmap).
- Guest mobile app, native staff apps.
- Other sectors (car rental, transport, law firms, clinics) under their own brands.
### 7.14 Ideas adopted from open-source research (later batches)
- Night audit (end-of-day close: post room charges, roll the business date, lock the day).
- Room move (change room mid-stay, keep folio + history).
- Duplicate-guest merge (same phone/email/document → merge profiles).

---

## 8. Integration strategy ($0 during the demo)

### 8.1 Rule
**Everything is built and wired. Paid services stay in `mock` or `sandbox` mode until a real client signs, then switch to `live`.** Each integration has 3 modes, set **per hotel** in the `integrations` table:
- `mock`: realistic fake responses, no network. **The default for demos** (pitches never break because a sandbox is down or trial credits run out).
- `sandbox`: provider's free test environment.
- `live`: real, paid.

### 8.2 Integration table

| Integration | Provider | Demo mode | Cost |
|---|---|---|---|
| Booking.com, Airbnb, Expedia, Agoda | Channex (white-label) via our channel adapter; iCal as a backup | Channex sandbox + iCal + mock | Free |
| WhatsApp | Meta Cloud API (direct, no middleman) | Meta free test number | Free |
| Instagram / Messenger | Meta Graph API | Developer app in dev mode with our own test accounts | Free |
| Online payments | Paysera (candidate). **Stripe doesn't work in Albania** | Sandbox or mock checkout | Free |
| Fiscalization | easyPos (easypos.al; Gerti preferred it over fature.al) or fature.al. Gerti is asking locally for a better partner | Test credentials or mock returning fake NIVF/NSLF/QR | Free |
| Voice agent | Vapi, Retell or ElevenLabs Agents | Free trial credits | Free |
| AI (chat, owner AI, OCR) | Vercel AI SDK + Claude or OpenAI | Free tier / a few dollars of credit | ~$0–5 |
| Email | Resend | Free tier | Free |
| Hosting + DB | Vercel Hobby + Supabase free | Free | Free |

### 8.3 OTA facts (why Channex, and why not direct)
- **Channex is not a competitor.** It's wholesale, white-label infrastructure for software companies. Hotels never see its name.
- **Airbnb API:** invitation-only, not accepting new requests.
- **Booking.com Connectivity API:** apply + meet requirements (PCI & PII compliance, cloud-based, rates and availability support) + certification. Reports (Feb 2026, unverified) say it's not accepting small new partners, possibly a ~2,000-listing minimum. Confirm with their connectivity team via their contact form.
- **Channex pricing (checked Sept 2026):** $130/month + $7/hotel/month (only hotels with an active channel; volume discounts at 500+). No setup fee, monthly, cancel anytime. **Free sandbox** for building and certifying. Going live requires Channex certification + OTA account authorization.
- **Alternatives to get quotes from before going live:** Rentals United, NextPax (white-label supply API). Also ask Channex about a startup discount.
- **iCal:** free, no approval needed, but syncs only every few hours and carries **no prices**, so there's double-booking risk. OK for the demo and small guesthouses, not for busy hotels.
- **Never use unofficial "cheap Booking.com APIs"** (RapidAPI scrapers etc.). They break and risk the hotel's account.
- **Long term:** apply to Booking.com connectivity once we have a NIPT + hotels. It's the biggest channel in Albania. Swap channels to direct connections one by one.

### 8.4 Adapter pattern (mandatory)
Our app never talks to a provider directly. It talks to an **adapter interface**, and the adapter picks the implementation from the hotel's `integrations.mode` + `provider`. Swapping Channex → direct Booking.com or easyPos → another provider doesn't touch the rest of the platform.

```
src/lib/integrations/
  types.ts            # IntegrationMode, shared result types
  registry.ts         # getAdapter(orgId, kind) → picks mock/sandbox/live implementation
  channel/            # adapter.ts, channex.ts, ical.ts, mock.ts
  fiscal/             # adapter.ts, easypos.ts, fature-al.ts, mock.ts
  payments/           # adapter.ts, paysera.ts, mock.ts
  messaging/          # adapter.ts, meta-whatsapp.ts, meta-instagram.ts, meta-messenger.ts, mock.ts
  voice/              # adapter.ts, vapi.ts, mock.ts
  email/              # adapter.ts, resend.ts, mock.ts
```

### 8.5 Fiscalization flow
Our system creates the invoice → certified provider API registers it with the tax authority → returns **NIVF, NSLF, QR code** → we print/attach them automatically. Legal from day one without our own certification. **Each hotel needs its own fiscal certificate** (same with any system). Later, with enough hotels, connect directly and get our own software certified.

### 8.6 Free-tier gotchas
- **Supabase free projects pause after ~1 week of inactivity.** Open the demo the day before a pitch or set up a ping (cron).
- Vercel Hobby is non-commercial only.
- Meta WhatsApp test number can only message a few verified test recipients.

---

## 9. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16 (App Router) + React 19 + TypeScript (strict)** | `src/proxy.ts` replaces `middleware.ts` in Next 16 |
| Hosting | **Vercel, region `fra1` (Frankfurt)** | EU data location. `vercel.json` sets region |
| Database | **Postgres on Supabase (EU/Frankfurt)** | Auth, Storage, Realtime, RLS |
| ORM | **Drizzle ORM** + drizzle-kit, `postgres` driver, `casing: 'snake_case'` | `prepare: false` for Supabase pooler |
| Auth | Supabase Auth via `@supabase/ssr` | Session refreshed in proxy |
| Styling | **Tailwind CSS v4** (CSS-first `@theme`) | No `tailwind.config` file |
| Components | Own components (shadcn-style patterns, **heavily restyled**; default shadcn look = generic SaaS, forbidden) | `class-variance-authority`, `clsx`, `tailwind-merge` |
| Motion (app) | **Motion** (`motion/react`) | |
| Motion (websites) | **GSAP + ScrollTrigger** (free for commercial use), **Lenis** smooth scroll | |
| 3D (optional) | React Three Fiber | Only for marketing/resort hero if worth it |
| Animated icons | Rive (optional) | |
| Charts | visx (custom), not generic chart libs | |
| i18n | **next-intl v4**, locales `sq` (default, no URL prefix) + `en` (`/en/...`) | `localePrefix: 'as-needed'` |
| Validation | zod v4 | |
| Dates | date-fns v4. DB: `timestamptz` UTC; check-in/out as `date`; hotel timezone `Europe/Tirane` | |
| Icons | lucide-react | |
| AI | Vercel AI SDK + Claude or OpenAI | Tool-calling for DB lookups/bookings |
| Background jobs | Inngest or Trigger.dev + Vercel Cron | OTA sync, reports, reminders |
| Real-time | Supabase Realtime | Calendar/inbox live updates |
| Email | Resend | |
| Voice | Vapi / Retell / ElevenLabs Agents | Provider handles audio; hits our `/api/voice/tools` |

**Vercel limits to respect:** serverless functions have time limits and no persistent WebSockets. Long work goes into background jobs. Voice audio is handled by the provider, not by us. Real-time comes from Supabase.

**Portability rule:** avoid Vercel-only features where possible, so enterprise clients can run on their own server (Docker).

---

## 10. Architecture

### 10.1 Multi-tenancy
- Tenant = `organizations` row (one hotel/resort business).
- **Every business table has `org_id`** (FK → organizations, cascade delete).
- Server code **always** scopes queries by `org_id` via a `requireOrg()` helper (user → membership → org). Never trust an `org_id` from the client.
- **RLS policies** in `supabase/sql/` protect any direct Supabase client access (Realtime, Storage): users see only rows of orgs they're members of.
- Drizzle connects with the DB role (bypasses RLS). Hence the strict `requireOrg()` rule in server code.

### 10.2 Modules and plans
- `org_modules (org_id, module, enabled)`. UI and server actions check `hasModule(org, 'pos')`.
- Module keys: `pms, calendar, channel_manager, booking_engine, ai_chat, inbox, pos, spa, invoicing, fiscalization, expenses, owner_ai, voice_agent, reports`.
- Plans: `basic, pro, premium, enterprise` map to default module sets (defined in `src/config/plans.ts`, Batch 16).

### 10.3 Routes
- `/` marketing site (Awwwards-level) · `/en` English.
- `/login` staff login (+ one-click demo login).
- `/app/...` dashboard (protected in `src/proxy.ts`).
- `/r/[slug]` public hotel website + booking engine (e.g. `/r/vala`), one per tenant.
- `/admin/...` super-admin (us).
- `/api/chat` guest AI chat · `/api/webhooks/meta` · `/api/webhooks/channex` · `/api/voice/tools` · `/api/cron/*`.

### 10.4 Sensitive data
- Passport/ID images: **private** Storage bucket, access limited to owner/manager/receptionist, **auto-delete after a set period** (`guests.document_delete_after`). Albania's data protection law is closely aligned with GDPR, and hotels will ask.
- Integration secrets are never stored in plain text in `integrations.config`. They go in env vars (demo) or are encrypted at rest (later).
- `audit_logs` records who did what (also powers fraud alerts and the staff activity report).

---

## 11. Data model (tables)

Defined in `src/db/schema/*`. Money = `numeric(12,2)`, rates = `numeric(5,2)`, quantities = `numeric(12,3)`. Localized text = `jsonb {sq, en}`.

- **Tenancy:** `organizations`, `profiles` (1:1 with `auth.users`), `memberships` (user↔org + role), `org_modules`, `integrations` (provider + mode per org), `audit_logs`.
- **Rooms:** `room_types`, `rooms` (with `layout` jsonb for the floor plan), `daily_rates` (price/min stay/closed per room type per day).
- **Guests:** `guests` (docs, VIP, tags, preferences, consent, document image + delete-after).
- **Bookings:** `bookings`, `folios`, `folio_items`.
- **POS/Spa:** `outlets`, `product_categories`, `products`, `pos_tables`, `pos_orders`, `pos_order_items`, `spa_services`, `spa_therapists`, `spa_appointments`.
- **Finance:** `invoices` (NIVF/NSLF/QR), `invoice_lines`, `payments`, `cash_shifts`, `expenses` (OCR data).
- **Messaging:** `conversations`, `messages`, `message_templates`, `call_logs`.
- **Ops/AI:** `housekeeping_tasks`, `maintenance_tickets`, `alerts`, `channel_mappings` (OTA room/rate mapping + iCal URLs/tokens), `owner_reports`.

VAT note (verify with an accountant): Albania standard VAT 20%, accommodation reduced rate 6%. Stored per line (`vat_rate`).

---

## 12. Demo data (seed, Batch 2)

**Vala Resort & Spa, Dhërmi** (fictional). Org slug `vala`, `is_demo = true`, plan `premium`, all modules on, all integrations `mock`.
- ~32 rooms over 4 floors: Standard Double, Deluxe Sea View, Junior Suite, Family Room, Villa with pool.
- Outlets: Restaurant "Kuzhina e Valës", Bar "Laguna", Pool Bar, Room Service, Spa "Vala Spa".
- ~60 guests (mixed nationalities: AL, IT, DE, UK, PL, XK, US), ~120 bookings across past 60 days → next 90 days, mixed sources/colors.
- Menus, spa services/therapists, invoices with mock NIVF/QR, expenses with receipts, WhatsApp/Instagram/web chat conversations, call logs, alerts (one cash difference, one unusual discount), owner reports.
- Demo users: owner, manager, receptionist, housekeeping, bar staff (password set via env `DEMO_PASSWORD`).

---

## 13. Design system: "Adriatic Quiet Luxury"

### 13.1 Principle
Two design worlds:
- **Websites** (marketing + resort): cinematic, Awwwards-level, built to impress in 30 seconds.
- **App** (dashboard): Linear/Stripe/Raycast-level craft. Fast, precise, calm. A receptionist uses it 8 hours a day.

The product should feel like a high-end Albanian coastal hotel: calm, warm, premium, unmistakably local, with no flag/eagle clichés.

### 13.2 Colors (tokens in `src/app/globals.css`)
- **Ionian** (primary, deep sea blue): 50 `#F1F6FA` · 100 `#E0EBF4` · 200 `#BCD4E8` · 300 `#8DB6D8` · 400 `#5B97C4` · 500 `#2E78AD` · 600 `#23618F` · 700 `#1B4D72` · 800 `#143A56` · 900 `#0F2A3F` · 950 `#0B1E2D`
- **Limestone** (warm neutrals; backgrounds instead of pure white): 50 `#FBF8F3` · 100 `#F6F1E8` · 200 `#EDE5D6` · 300 `#DDD2BE` · 400 `#C4B59B` · 500 `#A8977A` · 600 `#86765C` · 700 `#655843` · 800 `#463D2F` · 900 `#2A241C` · 950 `#17130E`
- **Olive** (success/available): 100 `#E8EDD9` · 400 `#8A9E57` · 500 `#6B7F3A` · 700 `#4A5A26`
- **Terracotta** (alerts/highlights): 100 `#F6E1D7` · 400 `#D8805F` · 500 `#C4623F` · 700 `#93452A`
- **Sunset gold** (AI moments only, sparingly): 100 `#F7ECD2` · 400 `#E0B354` · 500 `#C9962E`
- **Channel colors:** Booking.com `#2B5FB8` · Airbnb `#E2555A` · Expedia `#D9A520` · Agoda `#7A5CC4` · Website/direct `#6B7F3A` · WhatsApp `#2FA36B` · Instagram `#C4458A` · Messenger `#3B82F6` · Phone/AI voice `#8A6FD1` · Walk-in `#86765C`

### 13.3 Typography
- Display/headlines/big numbers: **Instrument Serif** (serif; revenue numbers look like a luxury magazine).
- UI: **Geist** (sans). Numbers/codes: **Geist Mono**.
- Loaded via `next/font/google` with `latin` + `latin-ext`. Check that **ë and ç** render correctly everywhere.

### 13.4 Themes
- **Day / Night / Auto.** Auto = day from 07:00 to 19:00, night otherwise (night reception shift). Stored in `localStorage.theme`, applied to `<html data-theme>` before paint (no flash).

### 13.5 Local identity
- Subtle pattern from traditional Albanian textile (qilim) geometry: empty states, loading screens, login page. Felt, not shouted (`.bg-qilim` utility).

### 13.6 Motion rules
- App animations **< 300ms** (`--duration-fast 150ms`, `--duration-base 220ms`, `--duration-slow 300ms`), easing `--ease-out-expo cubic-bezier(0.16,1,0.3,1)`.
- Respect `prefers-reduced-motion`.
- Skeleton loaders, not spinners. Optimistic updates. Numbers count up.

### 13.7 Signature features (maximum polish = "pitch screens")
1. **"Pyet hotelin" command bar (⌘K / Ctrl+K)**: ask in Albanian, answers inline with mini charts + action buttons. **Centerpiece of every pitch.**
2. **Morning briefing**: a short, beautifully typeset story instead of a wall of charts ("Mirëmëngjes, Gerti. Dje fituat €4,280, 12% më shumë se java e kaluar…").
3. **Living floor plan**: rooms on a visual map of floors, glowing by status.
4. **Master calendar**: smooth timeline, zoom, drag-and-drop with spring physics, new OTA bookings "land" with a pulse.
5. **AI inbox**: replies stream in live, clear "AI is handling / needs you" status, one-tap takeover.
6. **Resort website**: cinematic hero, smooth scroll, immersive room galleries, elegant floating AI concierge, 3-step booking with animated prices.
- Plus: micro-interactions everywhere, Simple mode, mobile-first owner experience.

### 13.8 Rules so beauty never hurts usability
- Albanian text is 20–30% longer than English. **Design every screen in Albanian first.**
- Must be fast on cheap reception PCs and older phones.
- References: Linear, Stripe, Vercel, Raycast (app). Aman Resorts + hospitality winners on awwwards.com (websites).

---

## 14. Build order (batches)

Each batch = one message of files. Tick in §20 when pasted and running.

| Batch | Content |
|---|---|
| 1 | PLAN.md, project config, design tokens, fonts, day/night theme, i18n (sq/en), Supabase clients, proxy, env, **full DB schema**, placeholder home |
| 2 | Supabase SQL (profile trigger, RLS policies, storage buckets), **seed data (Vala Resort)**, core UI primitives (Button, Input, Card, Badge, Dialog, Sheet, Tabs, Tooltip, Skeleton, Avatar, Kbd) |
| 3 | Auth (login page, one-click demo login, logout), `requireOrg()` / `hasModule()`, app shell (sidebar, topbar, org switcher, Simple mode toggle, ⌘K shell) |
| 4 | Today dashboard + Morning briefing |
| 5 | Rooms & room types, living floor plan, housekeeping board, maintenance |
| 6 | Bookings (create/edit/cancel/group), guests & profiles, check-in/out, folio |
| 7 | Master calendar (timeline, drag & drop, rates/availability, realtime) |
| 8 | Integration layer (modes, registry) + channel adapter (Channex sandbox, iCal import/export, mock) |
| 9 | Resort website `/r/[slug]` + booking engine + payments adapter (mock/Paysera sandbox) |
| 10 | AI guest chat (`/api/chat`, tools: availability, booking, upsell, handoff) |
| 11 | Unified inbox + Meta webhooks (WhatsApp/IG/Messenger) + guest journey automations + passport OCR check-in + templates |
| 12 | POS (restaurant/bar/pool bar), room charge, stock + Spa (services, therapists, appointments) |
| 13 | Invoicing + fiscalization adapter (mock/easyPos/fature.al) + payments + cash shifts |
| 14 | Expenses + AI receipt OCR + profit overview |
| 15 | Owner AI: "Pyet hotelin" (⌘K), WhatsApp/Telegram morning report, anomaly/fraud alerts, pricing suggestions |
| 16 | Reports + PDF/Excel export + staff activity log |
| 17 | Super-admin panel, plans & module toggles, cash payment tracking |
| 18 | AI voice receptionist (provider + `/api/voice/tools`, call logs) |
| 19 | Marketing website (Awwwards-level) + final polish of the pitch screens |

---

## 15. Repository structure

```
/PLAN.md
/package.json  /tsconfig.json  /next.config.ts  /postcss.config.mjs
/drizzle.config.ts  /vercel.json  /.env.example  /.gitignore
/messages/sq.json  /messages/en.json
/drizzle/                         # generated migrations (drizzle-kit)
/supabase/sql/                    # RLS, triggers, storage (Batch 2)
/src/proxy.ts                     # i18n + auth session + route protection
/src/app/globals.css              # design tokens (Tailwind v4 @theme)
/src/app/fonts.ts
/src/app/[locale]/layout.tsx
/src/app/[locale]/page.tsx        # marketing (placeholder until Batch 19)
/src/app/[locale]/login/          # Batch 3
/src/app/[locale]/app/            # dashboard (Batch 3+)
/src/app/[locale]/r/[slug]/       # tenant website + booking engine (Batch 9)
/src/app/[locale]/admin/          # super-admin (Batch 17)
/src/app/api/                     # chat, webhooks, voice, cron
/src/components/ui/               # primitives
/src/components/app/              # dashboard components
/src/components/resort/           # tenant website components
/src/components/marketing/
/src/components/theme/
/src/config/                      # brand.ts, plans.ts, modules.ts
/src/db/index.ts                  # drizzle client
/src/db/schema/                   # tables
/src/db/seed/                     # demo seed (Batch 2)
/src/i18n/                        # routing, navigation, request
/src/lib/supabase/                # server, client, admin, proxy helpers
/src/lib/integrations/            # adapters (Batch 8+)
/src/lib/ai/                      # prompts, tools (Batch 10+)
/src/lib/auth/                    # requireOrg, hasModule (Batch 3)
/src/server/queries/  /src/server/actions/
```

---

## 16. Conventions

- TypeScript strict. Server Components by default; `'use client'` only when needed.
- Mutations = Server Actions in `src/server/actions/*`, validated with zod, always through `requireOrg()`.
- **No hardcoded UI strings.** Everything goes through next-intl (`messages/sq.json`, `messages/en.json`). Albanian first.
- Localized DB content (room names, menu items) = `jsonb {sq, en}`.
- Money stored as numeric. Display with `Intl.NumberFormat` in the org currency.
- Times: `timestamptz` (UTC); stay dates: `date`; display in `Europe/Tirane`.
- Imports via `@/` alias.
- Commits: conventional (`feat:`, `fix:`, `chore:`), one batch = one or more commits.
- Never commit `.env.local`.

---

## 17. Setup (local + deploy)

1. `npm install`
2. Create a Supabase project in **EU (Frankfurt)**. Copy the URL, publishable (anon) key, service role key and the **transaction pooler** connection string (port 6543) into `.env.local` (see `.env.example`).
3. `npm run db:push` (creates tables). Later: `db:generate` + `db:migrate` for versioned migrations.
4. Run the SQL files in `supabase/sql/` in the Supabase SQL editor (Batch 2).
5. `npm run db:seed` (Batch 2).
6. `npm run dev` → http://localhost:3000 (Albanian) · http://localhost:3000/en (English).
7. Deploy: import the GitHub repo into Vercel, add the same env vars, region `fra1` (from `vercel.json`).

The app runs without Supabase env vars (the proxy skips auth), so the placeholder home works immediately.
### 17.1 GitHub-only setup (no local machine)
1. Supabase → New project → region **EU Central (Frankfurt)**. Save the DB password.
2. Supabase → Connect → copy two connection strings:
   - **Session pooler** (port **5432**) → GitHub secret `DATABASE_URL` (used by the Action; GitHub runners have no IPv6, so never the "direct" URL).
   - **Transaction pooler** (port **6543**) → Vercel env `DATABASE_URL`.
   - URL-encode special characters in the password (`@` → `%40`, `#` → `%23`).
3. GitHub repo → Settings → Secrets and variables → Actions → add `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`.
4. GitHub → Actions → "Database setup" → Run workflow (all three boxes ticked the first time). Later runs: untick "Run supabase/sql".
5. The workflow re-seeds the demo **every night (05:30 Tirana)**: dates stay fresh and Supabase never pauses. Demo edits are wiped nightly (intended).
6. Vercel → Add New Project → import the repo → env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (6543), `NEXT_PUBLIC_APP_URL`, `DEMO_PASSWORD`, `DEMO_LOGIN_ENABLED=true` → Deploy.
7. Every push to `main` redeploys. Build errors: Vercel → Deployments → the failed one → Build Logs.

---

## 18. Environment variables

See `.env.example`. Core: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `DEMO_PASSWORD`. AI/integrations (added in later batches, empty = mock): `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CHANNEX_API_KEY`, `CHANNEX_BASE_URL`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `PAYSERA_PROJECT_ID`, `PAYSERA_SIGN_PASSWORD`, `FISCAL_PROVIDER`, `EASYPOS_API_KEY`, `FATURE_AL_API_KEY`, `VOICE_PROVIDER`, `VAPI_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET`.

---

## 19. Open decisions and risks

- [ ] Brand name (hotel product) + parent company name.
- [ ] Final pricing (annual promo vs monthly tiers). Channel manager and voice as paid add-ons.
- [ ] Fiscalization partner (Gerti asking locally; easyPos currently preferred).
- [ ] Payment provider for Albania (Paysera candidate; confirm API + Albanian merchant support).
- [ ] Written partner agreement (roles, ownership, split).
- [ ] NIPT timing (near MVP).
- [ ] Confirm Booking.com connectivity requirements for new partners.
- [ ] Quotes from Rentals United / NextPax vs Channex; ask Channex about a startup discount.
- [ ] Albanian voice quality test (Vapi/Retell/ElevenLabs).
- [ ] BESA OS real prices + owner complaints (Gerti).
- [ ] Offline fiscalization strategy (roadmap).
- [ ] Data protection: passport retention period, privacy policy, DPA for hotels.
- Risk: new brand, no reviews → pilot hotels at founding price, collect real reviews.
- Risk: free tiers (Supabase pause, Meta test limits, trial credits) → demo defaults to `mock`.

---

## 20. Progress

- [x] Batch 1: foundation (this file, config, design tokens, theme, i18n, Supabase, proxy, schema)
- [x] Batch 2: SQL/RLS, seed, UI primitives
- [x] Batch 3: auth + app shell (login, one-click demo login by role, requireOrg/hasModule, sidebar, topbar, org switcher, Simple mode, ⌘K shell, placeholder routes)
- [x] Batch 4: dashboard + morning briefing (KPIs with count-up, 14-day revenue chart, arrivals/departures, alerts, room status, 7-day forecast, channel mix + OTA commissions, Simple mode, money hidden from non-finance roles)
- [ ] Batch 5: rooms, floor plan, housekeeping
- [ ] Batch 6: bookings, guests, folio
- [ ] Batch 7: master calendar
- [ ] Batch 8: integration layer + channel adapter
- [ ] Batch 9: resort website + booking engine + payments
- [ ] Batch 10: AI guest chat
- [ ] Batch 11: unified inbox + guest journey
- [ ] Batch 12: POS + spa
- [ ] Batch 13: invoicing, fiscalization, payments, shifts
- [ ] Batch 14: expenses + OCR
- [ ] Batch 15: owner AI
- [ ] Batch 16: reports
- [ ] Batch 17: super-admin + plans
- [ ] Batch 18: voice agent
- [ ] Batch 19: marketing site + polish

## 21. Changelog
- 2026-09-28: Plan created. Batch 1 delivered.
- 2026-09-28: Batch 2 delivered (+ fixes: `onDelete 'no action'`, boolean payment flags, `@theme static`, dates.ts paste error). Open-source research done (§5.1).
- 2026-09-28: Batch 3 delivered.
- 2026-09-28 · Batch 4 delivered. Added `radix-ui` to package.json (was missing). Added `.github/workflows/db-setup.yml` (schema push + SQL + seed from GitHub, nightly re-seed). Morning briefing is template-based for now (live data, Albanian-first ICU messages); Batch 15 swaps it for the AI version. Charts are hand-built (div/SVG + Motion), no visx, to keep the bundle small. Alert titles are stored in Albanian in the DB (English UI shows them in Albanian until Batch 15 localizes them).
- [x] Batch 5: authenticated room explorer, live room states and occupants,
  housekeeping task board with real DB transitions, maintenance reporting and
  resolution, audit events, and OpenRouter staff assistant with bounded read
  tools and human-confirmed housekeeping proposals.
- [ ] Batch 5 follow-up: interactive room layout editing; staff assignment
  controls; race-safe DB constraints for out-of-order rooms; atomic AI rate
  limiting; full guest/customer AI with public-session protections.
- [ ] Batch 6: bookings, guests and folios.
Operational demo data is never automatically reset. The GitHub database
workflow is manual; seeding destroys and recreates Vala's records. Never run
the seed against a real hotel's data.

OpenRouter is optional and billed by usage. OPENROUTER_API_KEY and
OPENROUTER_MODEL are server-only Vercel environment variables. Staff AI reads
only a bounded, hotel-scoped set of operations data. Its sole mutation path is
a displayed proposal that a human confirms through the same validated Server
Action used by the manual UI. Guest-facing AI is a separate security boundary
and is not implemented by this staff endpoint.
- [x] Batch 6: bookings workspace (arrivals / in-house / departures / upcoming /
  all with live counts), nightly quote engine (daily_rates → base price
  fallback, closed dates, min stay, max occupancy, peak-night availability),
  guest dedupe by email/phone, auto room assignment, confirm / check-in /
  check-out / cancel / no-show, room moves and manager upgrades, payments and
  refunds, folio charges with reversal-only voids, checkout → dirty room +
  urgent clean when same-day arrival, per-booking timeline from audit_logs,
  guest directory with lifetime value and history, read-only booking tools in
  staff AI. Double booking prevented by advisory lock per room type plus the
  DB exclusion constraint in supabase/sql/06.
- [ ] Batch 7: calendar/tape chart with drag-to-move using assignRoom.
- [x] Batch 7: master calendar /app/calendar: room rows grouped by type, unassigned
  lane, channel colours, 14/30/60-day windows + zoom, drag to move room (assignRoom),
  drag dates / resize with server preview (changeStay: quote engine, keep vs requote,
  manager-only keep when nights change, OTA warning), per-type availability + price row,
  manager bulk rates editor (price / min stay / open-closed, weekday filter, upsert),
  Supabase Realtime refresh (bookings, rooms, daily_rates) with landing pulse.
- [ ] Batch 8: integration layer + channel adapter (push rates from updateRates).

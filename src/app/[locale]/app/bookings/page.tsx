import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { BookingsWorkspace } from '@/components/app/bookings/bookings-workspace';
import { requireOrg } from '@/lib/auth/session'; import { todayIn } from '@/lib/dates'; import { BOOKING_VIEWS, getBookingCounts, getBookingDetail, getBookingFormData, listBookings, type BookingView, } from '@/server/queries/bookings';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ view?: string; q?: string; b?: string }>; };

export default async function BookingsPage({ params, searchParams }: Props) { const { locale } = await params; setRequestLocale(locale); const ctx = await requireOrg(); if (!ctx.modules.has('pms') || (!['owner', 'manager', 'receptionist'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) { notFound(); }

const sp = await searchParams; const view: BookingView = (BOOKING_VIEWS as readonly string[]).includes(sp.view ?? '') ? (sp.view as BookingView) : 'arrivals'; const q = (sp.q ?? '').slice(0, 80);

const [rows, counts, detail, form] = await Promise.all([ listBookings(ctx, view, q), getBookingCounts(ctx), getBookingDetail(ctx, sp.b), getBookingFormData(ctx), ]);

return ( <BookingsWorkspace rows={rows} counts={counts} view={view} q={q} detail={detail} form={form} today={todayIn(ctx.org.timezone)} locale={locale} currency={ctx.org.currency} manager={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin} /> ); }


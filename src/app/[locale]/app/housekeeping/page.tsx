import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { HousekeepingBoard } from '@/components/app/operations/housekeeping-board';
import { requireOrg } from '@/lib/auth/session';
import { getOperations } from '@/server/queries/operations';

type Props = { params: Promise<{ locale: string }> };

const sq = {
  title: 'Ritmi i përsosur, çdo ditë.',
  subtitle: 'Dhomat bëhen gati, defektet zgjidhen dhe asgjë nuk humbet në mesazhe.',
  eyebrow: 'Operacionet · pastrimi',
  open: 'Për t’u bërë',
  progress: 'Në punë',
  done: 'Të kryera sot',
  empty: 'Qetësi këtu.',
  maintenance: 'Mirëmbajtja',
  resolve: 'Shëno të zgjidhur',
  start: 'Fillo punën',
  complete: 'Përfundo',
  cancelled: 'Anuluar',
  due: 'Afati',
  assigned: 'Caktuar',
  unassigned: 'Pa caktuar',
  type: {
    checkout_clean: 'Pastrim pas largimit',
    stayover: 'Pastrim gjatë qëndrimit',
    inspection: 'Kontroll',
    deep_clean: 'Pastrim i thellë',
    turndown: 'Përgatitje mbrëmjeje',
  },
  priority: { low: 'E ulët', normal: 'Normale', high: 'E lartë', urgent: 'Urgjente' },
} as const;

const en = {
  title: 'Perfect rhythm, every day.',
  subtitle: 'Rooms get ready, maintenance gets handled, and nothing disappears into a message thread.',
  eyebrow: 'Operations · housekeeping',
  open: 'To do',
  progress: 'In progress',
  done: 'Completed today',
  empty: 'All quiet here.',
  maintenance: 'Maintenance',
  resolve: 'Mark resolved',
  start: 'Start work',
  complete: 'Complete',
  cancelled: 'Cancelled',
  due: 'Due',
  assigned: 'Assigned',
  unassigned: 'Unassigned',
  type: {
    checkout_clean: 'Checkout clean',
    stayover: 'Stayover clean',
    inspection: 'Inspection',
    deep_clean: 'Deep clean',
    turndown: 'Turndown',
  },
  priority: { low: 'Low', normal: 'Normal', high: 'High', urgent: 'Urgent' },
} as const;

export default async function HousekeepingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms') || !['owner', 'manager', 'receptionist', 'housekeeping'].includes(ctx.role)) notFound();
  const data = await getOperations(ctx);

  return (
    <HousekeepingBoard
      data={data}
      userId={ctx.user.id}
      canManage={ctx.role !== 'housekeeping' || ctx.profile.isSuperAdmin}
      copy={locale === 'en' ? en : sq}
    />
  );
}

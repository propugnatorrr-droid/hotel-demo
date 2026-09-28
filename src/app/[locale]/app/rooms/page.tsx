import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { RoomExplorer } from '@/components/app/operations/room-explorer';
import { requireOrg } from '@/lib/auth/session';
import { getOperations } from '@/server/queries/operations';

type Props = { params: Promise<{ locale: string }> };

const copy = {
  sq: {
    title: 'Çdo dhomë. Një pamje.',
    eyebrow: 'Harta e hotelit · në kohë reale',
    subtitle: 'Nga dhoma e parë te kati i fundit. Gjendja, mysafirët dhe punët që presin—gjithçka në një vend.',
    search: 'Kërko dhomën',
    all: 'Të gjitha',
    sea: 'Deti',
    room: 'Dhoma',
    occupied: 'Me mysafir',
    vacant: 'E lirë',
    due: 'largohet',
    tasks: 'detyra',
    floor: 'Kati',
    noResults: 'Nuk u gjet asnjë dhomë.',
    close: 'Mbyll',
    status: { inspected: 'E kontrolluar', clean: 'E pastër', dirty: 'Për pastrim', out_of_order: 'Jashtë shërbimit' },
    setStatus: 'Ndrysho gjendjen',
    createTask: 'Shto detyrë pastrimi',
    maintenance: 'Raporto defekt',
    titleInput: 'Çfarë ka ndodhur?',
    description: 'Përshkrimi',
    report: 'Krijo raportin',
    block: 'Nxirre dhomën jashtë shërbimit (kërkon dhomë pa rezervime)',
    notes: 'Shënim për ekipin',
    save: 'Ruaj',
    taskType: {
      checkout_clean: 'Pastrim pas largimit',
      stayover: 'Pastrim gjatë qëndrimit',
      inspection: 'Kontroll',
      deep_clean: 'Pastrim i thellë',
      turndown: 'Përgatitje mbrëmjeje',
    },
  },
  en: {
    title: 'Every room. One view.',
    eyebrow: 'Hotel map · live',
    subtitle: 'From the first room to the top floor. Status, guests, and pending work—all in one place.',
    search: 'Find a room',
    all: 'All',
    sea: 'Sea',
    room: 'Room',
    occupied: 'Occupied',
    vacant: 'Vacant',
    due: 'departs',
    tasks: 'tasks',
    floor: 'Floor',
    noResults: 'No rooms found.',
    close: 'Close',
    status: { inspected: 'Inspected', clean: 'Clean', dirty: 'Needs cleaning', out_of_order: 'Out of order' },
    setStatus: 'Change status',
    createTask: 'Add housekeeping task',
    maintenance: 'Report maintenance',
    titleInput: 'What happened?',
    description: 'Description',
    report: 'Create ticket',
    block: 'Take room out of service (only if it has no bookings)',
    notes: 'Note for team',
    save: 'Save',
    taskType: {
      checkout_clean: 'Checkout clean',
      stayover: 'Stayover clean',
      inspection: 'Inspection',
      deep_clean: 'Deep clean',
      turndown: 'Turndown',
    },
  },
} as const;

export default async function RoomsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms') || !['owner', 'manager', 'receptionist', 'housekeeping'].includes(ctx.role)) notFound();
  const data = await getOperations(ctx);

  return (
    <div className="mx-auto max-w-7xl">
      <RoomExplorer
        data={data}
        locale={locale}
        manager={ctx.role === 'owner' || ctx.role === 'manager' || ctx.profile.isSuperAdmin}
        copy={locale === 'en' ? copy.en : copy.sq}
      />
    </div>
  );
}

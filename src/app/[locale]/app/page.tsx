import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { requireOrg } from '@/lib/auth/session';

type Props = { params: Promise<{ locale: string }> };

export default async function TodayPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await requireOrg();
  const t = await getTranslations('dashboard');
  const tGreeting = await getTranslations('shell.greeting');

  const hour =
    Number(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: ctx.org.timezone }).format(new Date()),
    ) % 24;
  const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const firstName = ctx.profile.fullName?.split(' ')[0];

  return (
    <div className="mx-auto max-w-6xl">
      <p className="animate-fade-up text-sm text-muted">{t('subtitle', { org: ctx.org.name })}</p>
      <h1 className="font-display animate-fade-up mt-2 text-5xl [animation-delay:60ms] md:text-7xl">
        {tGreeting(greeting)}
        {firstName ? `, ${firstName}` : ''}.
      </h1>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-4 h-9 w-32" />
            <Skeleton className="mt-3 h-3 w-20" />
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-5 h-56 w-full" />
        </Card>
        <Card className="space-y-3 p-5">
          <Skeleton className="h-3 w-28" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      </div>

      <p className="mt-8 text-sm text-subtle">{t('placeholderBody')}</p>
    </div>
  );
}

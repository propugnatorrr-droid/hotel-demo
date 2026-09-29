import { getLocale } from 'next-intl/server';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import type { OrgContext } from '@/lib/auth/session';
import { CommandTrigger } from './command-trigger';
import { LocaleSwitch } from './locale-switch';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';

export async function Topbar({ ctx, navKeys }: { ctx: OrgContext; navKeys: string[] }) {
  const locale = await getLocale();
  const date = new Intl.DateTimeFormat(locale === 'sq' ? 'sq-AL' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: ctx.org.timezone,
  }).format(new Date());

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-8">
      <MobileNav navKeys={navKeys} orgs={ctx.orgs} activeOrgId={ctx.org.id} simpleMode={ctx.profile.simpleMode} />
      <p className="hidden w-44 shrink-0 text-sm text-muted first-letter:uppercase xl:block">{date}</p>
      <div className="flex min-w-0 flex-1 justify-center">
        <CommandTrigger />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <LocaleSwitch className="hidden sm:inline-flex" />
        <ThemeToggle className="hidden sm:inline-flex" />
        <UserMenu
          name={ctx.profile.fullName ?? ctx.user.email}
          email={ctx.user.email}
          role={ctx.role}
          avatarUrl={ctx.profile.avatarUrl}
          superAdmin={ctx.profile.isSuperAdmin}
        />
      </div>
    </header>
  );
}

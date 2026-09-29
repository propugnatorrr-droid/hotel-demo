import { setRequestLocale } from 'next-intl/server';
import { CommandBar } from '@/components/app/command-bar';
import { DemoBanner } from '@/components/app/demo-banner';
import { Sidebar } from '@/components/app/sidebar';
import { Topbar } from '@/components/app/topbar';
import { accessibleNavKeys, sidebarNavKeys } from '@/config/navigation';
import { requireOrg } from '@/lib/auth/session';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await requireOrg();
  const navKeys = sidebarNavKeys(ctx.role, ctx.modules, ctx.profile.simpleMode);
  const commandKeys = accessibleNavKeys(ctx.role, ctx.modules);

  const money = ['owner', 'manager', 'accountant'].includes(ctx.role) || ctx.profile.isSuperAdmin;
  const aiMode: 'owner' | 'staff' | null = money && ctx.modules.has('owner_ai') ? 'owner' : ctx.modules.has('pms') && ['receptionist', 'housekeeping', 'owner', 'manager'].includes(ctx.role) ? 'staff' : null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar navKeys={navKeys} orgs={ctx.orgs} activeOrgId={ctx.org.id} simpleMode={ctx.profile.simpleMode} />
      <div className="flex min-w-0 flex-1 flex-col">
        {ctx.org.isDemo && <DemoBanner />}
        <Topbar ctx={ctx} navKeys={navKeys} />
        <main className="page-enter flex-1 px-5 py-8 md:px-14 md:py-16">{children}</main>
      </div>
      <CommandBar navKeys={commandKeys} aiMode={aiMode} locale={locale} currency={ctx.org.currency} />
    </div>
  );
}

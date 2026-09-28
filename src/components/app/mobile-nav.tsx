'use client';

import { Menu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { usePathname } from '@/i18n/navigation';
import type { OrgSummary } from '@/lib/auth/session';
import { NavList } from './nav-list';
import { OrgSwitcher } from './org-switcher';
import { SimpleModeToggle } from './simple-mode-toggle';

type MobileNavProps = {
  navKeys: string[];
  orgs: OrgSummary[];
  activeOrgId: string;
  simpleMode: boolean;
};

export function MobileNav({ navKeys, orgs, activeOrgId, simpleMode }: MobileNavProps) {
  const t = useTranslations('shell');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('openMenu')}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent closeLabel={tCommon('close')} aria-describedby={undefined} className="max-w-xs bg-background">
        <SheetTitle className="sr-only">{t('openMenu')}</SheetTitle>
        <div className="px-3 pt-4 pr-12 pb-4">
          <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavList navKeys={navKeys} id="mobile" />
        </nav>
        <div className="border-t border-border p-3">
          <SimpleModeToggle enabled={simpleMode} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

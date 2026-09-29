'use client';

import { LayoutGroup, motion } from 'motion/react';
import { Ellipsis, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { NAV } from '@/config/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import type { OrgSummary } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { HapticsToggle } from './haptics-toggle';
import { LocaleSwitch } from './locale-switch';
import { NavList } from './nav-list';
import { OrgSwitcher } from './org-switcher';
import { SimpleModeToggle } from './simple-mode-toggle';

const PRIORITY = ['today', 'calendar', 'bookings', 'inbox', 'housekeeping', 'pos', 'spa', 'invoices', 'reports', 'rooms', 'guests'];

type Props = { navKeys: string[]; orgs: OrgSummary[]; activeOrgId: string; simpleMode: boolean };

/**
 * Phone navigation: an iOS-style tab bar with the AI agent as a raised centre button and a
 * "More" bottom sheet for everything else. Hides itself while a text field has focus so the
 * keyboard never stacks on top of it.
 */
export function MobileTabBar({ navKeys, orgs, activeOrgId, simpleMode }: Props) {
  const t = useTranslations('nav');
  const tShell = useTranslations('shell');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    setMore(false);
  }, [pathname]);

  useEffect(() => {
    const on = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      setTyping(!!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type));
    };
    const off = () => setTyping(false);
    document.addEventListener('focusin', on);
    document.addEventListener('focusout', off);
    return () => {
      document.removeEventListener('focusin', on);
      document.removeEventListener('focusout', off);
    };
  }, []);

  const items = PRIORITY.map((k) => NAV.find((n) => n.key === k && navKeys.includes(k))).filter((n): n is (typeof NAV)[number] => !!n).slice(0, 4);
  const ai = NAV.find((n) => n.key === 'assistant' && navKeys.includes('assistant'));
  const left = items.slice(0, 2);
  const right = items.slice(2);

  const isActive = (href: string) => (href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`));

  const tab = (item: (typeof NAV)[number]) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link key={item.key} href={item.href} aria-current={active ? 'page' : undefined} className="tap relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium">
        {active && (
          <motion.span layoutId="tab-pill" transition={{ type: 'spring', stiffness: 520, damping: 38 }} className="absolute top-1 h-8 w-14 rounded-full bg-primary/10" />
        )}
        <Icon className={cn('relative size-[22px] transition-colors', active ? 'text-primary' : 'text-subtle')} strokeWidth={active ? 1.9 : 1.6} />
        <span className={cn('relative max-w-full truncate px-1 transition-colors', active ? 'text-foreground' : 'text-subtle')}>{t(`items.${item.key}`)}</span>
      </Link>
    );
  };

  return (
    <>
      <nav
        data-tabbar
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-2xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden',
          typing && 'translate-y-full',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <LayoutGroup id="tabbar">
          <div className="mx-auto flex max-w-lg items-end px-2">
            {left.map(tab)}
            {ai && (
              <Link
                href={ai.href}
                aria-label={t('items.assistant')}
                data-haptic="medium"
                className={cn(
                  'ai-glow tap relative -mt-5 mb-1.5 grid size-14 shrink-0 place-items-center rounded-full text-accent shadow-float',
                  isActive(ai.href) && 'ring-2 ring-gold-400/60 ring-offset-2 ring-offset-background',
                )}
              >
                <Sparkles className="size-6" strokeWidth={1.7} />
              </Link>
            )}
            {right.map(tab)}
            <button type="button" onClick={() => setMore(true)} className="tap relative flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium text-subtle">
              <Ellipsis className="size-[22px]" strokeWidth={1.6} />
              <span>{tShell('more')}</span>
            </button>
          </div>
        </LayoutGroup>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent closeLabel={tCommon('close')} aria-describedby={undefined} className="bg-background max-md:min-h-[60dvh]">
          <SheetTitle className="sr-only">{tShell('openMenu')}</SheetTitle>
          <div className="px-4 pt-3 pr-14 pb-3">
            <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
          </div>
          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            <NavList navKeys={navKeys} id="more" />
          </nav>
          <div className="space-y-1 border-t border-border p-3">
            <SimpleModeToggle enabled={simpleMode} />
            <HapticsToggle />
            <div className="flex items-center gap-2 px-2.5 pt-2">
              <LocaleSwitch />
              <ThemeToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

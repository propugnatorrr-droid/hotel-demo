'use client';

import { LayoutGroup, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import { NAV, NAV_GROUPS } from '@/config/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function NavList({ navKeys, id }: { navKeys: string[]; id: string }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const items = NAV.filter((i) => navKeys.includes(i.key));

  const activeKey = [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.key;

  return (
    <LayoutGroup id={id}>
      <div className="space-y-6">
        {NAV_GROUPS.map((group) => {
          const list = items.filter((i) => i.group === group);
          if (list.length === 0) return null;
          return (
            <div key={group}>
              <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-[0.14em] text-subtle uppercase">
                {t(`groups.${group}`)}
              </p>
              <ul className="space-y-0.5">
                {list.map((item) => {
                  const active = item.key === activeKey;
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-150',
                          active ? 'text-foreground' : 'text-muted hover:text-foreground',
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-0 rounded-md border border-border bg-surface shadow-soft"
                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                          />
                        )}
                        <Icon className="relative size-4 shrink-0" strokeWidth={1.6} />
                        <span className="relative truncate">{t(`items.${item.key}`)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

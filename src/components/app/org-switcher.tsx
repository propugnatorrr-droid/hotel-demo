'use client';

import { Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenu } from 'radix-ui';
import { useTransition } from 'react';
import { dropdownContent, dropdownItem, dropdownLabel } from '@/components/ui/dropdown';
import type { OrgSummary } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { setActiveOrg } from '@/server/actions/preferences';

function OrgTile({ org }: { org: OrgSummary }) {
  const t = useTranslations('roles');
  return (
    <>
      <span className="font-display flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-xl text-primary-foreground">
        {org.name.charAt(0)}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{org.name}</span>
        <span className="block truncate text-xs text-subtle">{t(org.role)}</span>
      </span>
    </>
  );
}

export function OrgSwitcher({ orgs, activeOrgId }: { orgs: OrgSummary[]; activeOrgId: string }) {
  const t = useTranslations('shell');
  const [pending, start] = useTransition();
  const active = orgs.find((o) => o.id === activeOrgId) ?? orgs[0];
  if (!active) return null;

  if (orgs.length <= 1) {
    return (
      <div className="flex items-center gap-3 rounded-lg px-1.5 py-1">
        <OrgTile org={active} />
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={pending}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface data-[state=open]:bg-surface',
          pending && 'opacity-60',
        )}
      >
        <OrgTile org={active} />
        <ChevronsUpDown className="size-4 text-subtle" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className={dropdownContent}>
          <DropdownMenu.Label className={dropdownLabel}>{t('switchOrg')}</DropdownMenu.Label>
          {orgs.map((org) => (
            <DropdownMenu.Item
              key={org.id}
              className={dropdownItem}
              onSelect={() => start(() => setActiveOrg(org.id))}
            >
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === active.id && <Check />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

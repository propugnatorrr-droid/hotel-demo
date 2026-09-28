'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DropdownMenu } from 'radix-ui';
import { useTransition } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { dropdownContent, dropdownItem, dropdownSeparator } from '@/components/ui/dropdown';
import type { Role } from '@/lib/auth/types';
import { signOut } from '@/server/actions/auth';

type UserMenuProps = { name: string; email: string; role: Role; avatarUrl?: string | null };

export function UserMenu({ name, email, role, avatarUrl }: UserMenuProps) {
  const t = useTranslations('shell');
  const tRoles = useTranslations('roles');
  const [pending, start] = useTransition();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={pending}
        className="flex items-center gap-2.5 rounded-full p-0.5 pr-0.5 transition-colors hover:bg-surface md:pr-3"
      >
        <Avatar name={name} src={avatarUrl} size="sm" />
        <span className="hidden text-left md:block">
          <span className="block max-w-32 truncate text-sm leading-tight">{name}</span>
          <span className="block text-[11px] leading-tight text-subtle">{tRoles(role)}</span>
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className={dropdownContent}>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-subtle">{email}</p>
          </div>
          <DropdownMenu.Separator className={dropdownSeparator} />
          <DropdownMenu.Item className={dropdownItem} onSelect={() => start(() => signOut())}>
            <LogOut />
            {t('signOut')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

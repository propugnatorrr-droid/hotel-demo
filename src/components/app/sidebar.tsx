'use client';

import type { OrgSummary } from '@/lib/auth/session';
import { NavList } from './nav-list';
import { OrgSwitcher } from './org-switcher';
import { SimpleModeToggle } from './simple-mode-toggle';

type SidebarProps = {
  navKeys: string[];
  orgs: OrgSummary[];
  activeOrgId: string;
  simpleMode: boolean;
};

export function Sidebar({ navKeys, orgs, activeOrgId, simpleMode }: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface-2/50 lg:flex">
      <div className="px-3 pt-4 pb-4">
        <OrgSwitcher orgs={orgs} activeOrgId={activeOrgId} />
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <NavList navKeys={navKeys} id="sidebar" />
      </nav>
      <div className="border-t border-border p-3">
        <SimpleModeToggle enabled={simpleMode} />
      </div>
    </aside>
  );
}

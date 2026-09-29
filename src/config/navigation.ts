import {
  BedDouble,
  CalendarRange,
  ClipboardList,
  Flower2,
  Inbox,
  LayoutDashboard,
  Network,
  PhoneCall,
  Receipt,
  Settings,
  Sparkles,
  SprayCan,
  TrendingUp,
  Users,
  Wallet,
  Wine,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey, Role } from '@/lib/auth/types';

export type NavGroup = 'operations' | 'communication' | 'sales' | 'finance' | 'system';

export type NavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  group: NavGroup;
  module: ModuleKey | null;
  roles: readonly Role[];
  simple: boolean;
  batch: number;
};

const ALL: readonly Role[] = ['owner', 'manager', 'receptionist', 'housekeeping', 'pos', 'spa', 'accountant'];
const FRONT: readonly Role[] = ['owner', 'manager', 'receptionist'];

export const NAV_GROUPS: NavGroup[] = ['operations', 'communication', 'sales', 'finance', 'system'];

export const NAV: NavItem[] = [
  { key: 'today', href: '/app', icon: LayoutDashboard, group: 'operations', module: null, roles: ALL, simple: true, batch: 4 },
  { key: 'calendar', href: '/app/calendar', icon: CalendarRange, group: 'operations', module: 'calendar', roles: FRONT, simple: true, batch: 7 },
  { key: 'bookings', href: '/app/bookings', icon: ClipboardList, group: 'operations', module: 'pms', roles: FRONT, simple: true, batch: 6 },
  { key: 'rooms', href: '/app/rooms', icon: BedDouble, group: 'operations', module: 'pms', roles: [...FRONT, 'housekeeping'], simple: false, batch: 5 },
  { key: 'housekeeping', href: '/app/housekeeping', icon: SprayCan, group: 'operations', module: 'pms', roles: [...FRONT, 'housekeeping'], simple: false, batch: 5 },
  { key: 'guests', href: '/app/guests', icon: Users, group: 'operations', module: 'pms', roles: FRONT, simple: false, batch: 6 },
  { key: 'assistant', href: '/app/assistant', icon: Sparkles, group: 'communication', module: 'pms', roles: [...FRONT, 'housekeeping', 'accountant'], simple: true, batch: 5 },
  { key: 'inbox', href: '/app/inbox', icon: Inbox, group: 'communication', module: 'inbox', roles: FRONT, simple: true, batch: 11 },
  { key: 'voice', href: '/app/voice', icon: PhoneCall, group: 'communication', module: 'voice_agent', roles: FRONT, simple: false, batch: 18 },
  { key: 'pos', href: '/app/pos', icon: Wine, group: 'sales', module: 'pos', roles: ['owner', 'manager', 'pos'], simple: false, batch: 12 },
  { key: 'spa', href: '/app/spa', icon: Flower2, group: 'sales', module: 'spa', roles: ['owner', 'manager', 'receptionist', 'spa'], simple: false, batch: 12 },
  { key: 'invoices', href: '/app/invoices', icon: Receipt, group: 'finance', module: 'invoicing', roles: ['owner', 'manager', 'receptionist', 'accountant'], simple: false, batch: 13 },
  { key: 'expenses', href: '/app/expenses', icon: Wallet, group: 'finance', module: 'expenses', roles: ['owner', 'manager', 'accountant'], simple: false, batch: 14 },
  { key: 'reports', href: '/app/reports', icon: TrendingUp, group: 'finance', module: 'reports', roles: ['owner', 'manager', 'accountant'], simple: true, batch: 16 },
  { key: 'channels', href: '/app/channels', icon: Network, group: 'system', module: 'channel_manager', roles: ['owner', 'manager'], simple: false, batch: 8 },
  { key: 'settings', href: '/app/settings', icon: Settings, group: 'system', module: null, roles: ['owner', 'manager'], simple: false, batch: 17 },
];

export function canAccess(item: NavItem, role: Role, modules: ReadonlySet<string>) {
  return item.roles.includes(role) && (!item.module || modules.has(item.module));
}

export function accessibleNavKeys(role: Role, modules: ReadonlySet<string>) {
  return NAV.filter((i) => canAccess(i, role, modules)).map((i) => i.key);
}

export function sidebarNavKeys(role: Role, modules: ReadonlySet<string>, simple: boolean) {
  return NAV.filter((i) => canAccess(i, role, modules) && (!simple || i.simple)).map((i) => i.key);
}

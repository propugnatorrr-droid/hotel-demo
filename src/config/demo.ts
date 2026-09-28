// Must match the emails in src/db/seed/data.ts
export const DEMO_ROLES = ['owner', 'manager', 'receptionist', 'housekeeping', 'pos'] as const;
export type DemoRole = (typeof DEMO_ROLES)[number];

export const DEMO_ACCOUNTS: Record<DemoRole, string> = {
  owner: 'owner@vala-demo.test',
  manager: 'manager@vala-demo.test',
  receptionist: 'reception@vala-demo.test',
  housekeeping: 'housekeeping@vala-demo.test',
  pos: 'bar@vala-demo.test',
};

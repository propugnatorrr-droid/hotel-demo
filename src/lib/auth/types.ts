import type { memberRole, moduleKey } from '@/db/schema/enums';

export type Role = (typeof memberRole.enumValues)[number];
export type ModuleKey = (typeof moduleKey.enumValues)[number];

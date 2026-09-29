import type { department } from '@/db/schema/enums';

type Dept = (typeof department.enumValues)[number];

export const EXPENSE_CATEGORY_DEFS: Record<string, { sq: string; en: string; department: Dept }> = {
  food_beverage: { sq: 'Ushqime & pije', en: 'Food & beverage', department: 'restaurant' },
  utilities: { sq: 'Energji & ujë', en: 'Utilities', department: 'admin' },
  maintenance: { sq: 'Mirëmbajtje', en: 'Maintenance', department: 'maintenance' },
  cleaning: { sq: 'Pastrim & higjienë', en: 'Cleaning & hygiene', department: 'rooms' },
  staff: { sq: 'Staf', en: 'Staff', department: 'staff' },
  marketing: { sq: 'Marketing', en: 'Marketing', department: 'marketing' },
  supplies: { sq: 'Furnizime', en: 'Supplies', department: 'rooms' },
  rent: { sq: 'Qira', en: 'Rent', department: 'admin' },
  tax: { sq: 'Taksa', en: 'Taxes', department: 'admin' },
  other: { sq: 'Të tjera', en: 'Other', department: 'other' },
};

export const DEPARTMENTS: Dept[] = ['rooms', 'restaurant', 'bar', 'spa', 'maintenance', 'marketing', 'admin', 'staff', 'other'];

/** Albanian lek per euro used to convert expenses into the hotel currency. Overridable in org.settings.fxAllPerEur. */
export const DEFAULT_ALL_PER_EUR = 100;
export const DEFAULT_ALL_PER_USD = 92;

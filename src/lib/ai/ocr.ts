import 'server-only';
import { visionJson } from './openrouter';

export type PassportData = {
  firstName?: string;
  lastName?: string;
  documentType?: string;
  documentNumber?: string;
  dateOfBirth?: string;
  nationality?: string;
  expiry?: string;
  confidence?: number;
};

export async function extractPassport(image: string): Promise<PassportData | null> {
  const r = await visionJson<PassportData>(
    image,
    'Read this passport or ID card. Return JSON with keys: firstName, lastName, documentType ("passport" or "id_card"), documentNumber, dateOfBirth (YYYY-MM-DD), nationality (country name in English), expiry (YYYY-MM-DD), confidence (0..1). Omit keys you cannot read. If the image is not an identity document return {"confidence":0}.',
  );
  if (!r || !r.confidence || r.confidence < 0.4) return null;
  const isoDate = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  return {
    firstName: r.firstName?.toString().slice(0, 80),
    lastName: r.lastName?.toString().slice(0, 80),
    documentType: r.documentType === 'id_card' ? 'id_card' : 'passport',
    documentNumber: r.documentNumber?.toString().replace(/\s/g, '').slice(0, 30),
    dateOfBirth: isoDate(r.dateOfBirth),
    nationality: r.nationality?.toString().slice(0, 56),
    expiry: isoDate(r.expiry),
    confidence: r.confidence,
  };
}

export const EXPENSE_CATEGORIES = ['food_beverage', 'utilities', 'maintenance', 'cleaning', 'staff', 'marketing', 'supplies', 'rent', 'tax', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ReceiptData = {
  supplier?: string;
  supplierNipt?: string;
  invoiceNumber?: string;
  date?: string;
  total?: number;
  vat?: number;
  currency?: 'ALL' | 'EUR' | 'USD';
  category?: ExpenseCategory;
  description?: string;
  confidence?: number;
};

export async function extractReceipt(image: string): Promise<ReceiptData | null> {
  const r = await visionJson<ReceiptData>(
    image,
    `Read this supplier receipt or invoice (Albanian or English). Return JSON with keys: supplier, supplierNipt (Albanian tax id like K12345678A, if visible), invoiceNumber, date (YYYY-MM-DD), total (gross number), vat (VAT amount number), currency ("ALL","EUR" or "USD"; Lek = ALL), category (one of ${EXPENSE_CATEGORIES.join(', ')}), description (max 80 chars), confidence (0..1). Omit what you cannot read. If it is not a receipt return {"confidence":0}.`,
  );
  if (!r || !r.confidence || r.confidence < 0.3) return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : typeof v === 'string' && !Number.isNaN(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : undefined);
  return {
    supplier: r.supplier?.toString().slice(0, 120),
    supplierNipt: r.supplierNipt?.toString().replace(/\s/g, '').slice(0, 20),
    invoiceNumber: r.invoiceNumber?.toString().slice(0, 40),
    date: r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : undefined,
    total: num(r.total),
    vat: num(r.vat),
    currency: r.currency === 'EUR' || r.currency === 'USD' ? r.currency : 'ALL',
    category: EXPENSE_CATEGORIES.includes(r.category as ExpenseCategory) ? r.category : 'other',
    description: r.description?.toString().slice(0, 120),
    confidence: r.confidence,
  };
}

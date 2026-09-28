import type { bookingSource } from '@/db/schema/enums';

export type BookingSource = (typeof bookingSource.enumValues)[number];

export const SOURCE_COLOR: Record<BookingSource, string> = {
  direct: 'var(--color-ch-direct)',
  website: 'var(--color-ch-direct)',
  booking_com: 'var(--color-ch-booking)',
  airbnb: 'var(--color-ch-airbnb)',
  expedia: 'var(--color-ch-expedia)',
  agoda: 'var(--color-ch-agoda)',
  whatsapp: 'var(--color-ch-whatsapp)',
  instagram: 'var(--color-ch-instagram)',
  messenger: 'var(--color-ch-messenger)',
  phone: 'var(--color-ch-phone)',
  ai_voice: 'var(--color-ch-phone)',
  walk_in: 'var(--color-ch-walkin)',
};

export const OTA_SOURCES: readonly BookingSource[] = ['booking_com', 'airbnb', 'expedia', 'agoda'];

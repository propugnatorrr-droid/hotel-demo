import type { BookingSource } from '@/config/channels';

export class ChannelError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'ChannelError';
  }
}

export type AvailabilityValue = {
  property_id: string;
  room_type_id: string;
  date_from: string;
  date_to: string;
  availability: number;
};

export type RestrictionValue = {
  property_id: string;
  rate_plan_id: string;
  date_from: string;
  date_to: string;
  rate?: string;
  min_stay_arrival: number;
  stop_sell: boolean;
};

export type PushResult = { warnings: string[] };

export type ChannelRevision = {
  id: string;
  propertyId: string;
  status: 'new' | 'modified' | 'cancelled';
  otaName: string;
  otaCode: string;
  arrival: string;
  departure: string;
  arrivalHour: string | null;
  amount: number;
  commission: number;
  currency: string;
  notes: string | null;
  paymentCollect: 'property' | 'ota' | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    country: string | null;
    language: string | null;
  };
  rooms: {
    externalRoomTypeId: string | null;
    checkIn: string;
    checkOut: string;
    amount: number;
    adults: number;
    children: number;
  }[];
};

export interface ChannelAdapter {
  kind: 'mock' | 'channex';
  pushAvailability(values: AvailabilityValue[]): Promise<PushResult>;
  pushRestrictions(values: RestrictionValue[]): Promise<PushResult>;
  fetchFeed(): Promise<ChannelRevision[]>;
  ack(revisionId: string): Promise<void>;
}

export type SimChannel = Extract<BookingSource, 'booking_com' | 'airbnb' | 'expedia'>;

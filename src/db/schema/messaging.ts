import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, type Localized } from './columns';
import { bookings } from './bookings';
import { conversationStatus, messageAuthor, messageChannel, messageDirection } from './enums';
import { guests } from './guests';
import { orgRef, profiles } from './tenancy';

export const conversations = pgTable(
  'conversations',
  {
    id: id(),
    orgId: orgRef(),
    guestId: uuid().references(() => guests.id, { onDelete: 'set null' }),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'set null' }),
    channel: messageChannel().notNull(),
    externalId: text(),
    contactName: text(),
    contactHandle: text(),
    language: text(),
    status: conversationStatus().notNull().default('ai_handling'),
    aiEnabled: boolean().notNull().default(true),
    assignedTo: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    unreadCount: integer().notNull().default(0),
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastMessagePreview: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('conversations_org_channel_ext_uq').on(t.orgId, t.channel, t.externalId),
    index('conversations_org_last_idx').on(t.orgId, t.lastMessageAt),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: id(),
    orgId: orgRef(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    direction: messageDirection().notNull(),
    author: messageAuthor().notNull(),
    authorUserId: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    body: text().notNull(),
    attachments: jsonb().$type<{ type: string; url: string; name?: string }[]>().notNull().default([]),
    externalId: text(),
    aiMeta: jsonb().$type<{ model?: string; toolCalls?: unknown[]; confidence?: number }>(),
    deliveredAt: timestamp({ withTimezone: true }),
    readAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('messages_conversation_created_idx').on(t.conversationId, t.createdAt)],
);

export const messageTemplates = pgTable(
  'message_templates',
  {
    id: id(),
    orgId: orgRef(),
    key: text().notNull(),
    name: text().notNull(),
    body: jsonb().$type<Localized>().notNull(),
    channel: messageChannel(),
    trigger: text(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('message_templates_org_key_uq').on(t.orgId, t.key)],
);

export const callLogs = pgTable(
  'call_logs',
  {
    id: id(),
    orgId: orgRef(),
    conversationId: uuid().references(() => conversations.id, { onDelete: 'set null' }),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'set null' }),
    provider: text().notNull(),
    externalId: text(),
    fromNumber: text(),
    toNumber: text(),
    language: text(),
    durationSec: integer().notNull().default(0),
    outcome: text(),
    summary: text(),
    transcript: jsonb().$type<{ role: 'ai' | 'caller' | 'staff'; text: string; at?: number }[]>(),
    recordingUrl: text(),
    transferredTo: text(),
    createdAt: createdAt(),
  },
  (t) => [index('call_logs_org_created_idx').on(t.orgId, t.createdAt)],
);

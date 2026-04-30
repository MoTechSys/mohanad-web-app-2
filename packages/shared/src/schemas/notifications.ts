/**
 * Notifications schemas (Phase 3 — P3-5).
 *
 * مشتركة بين الباكند والفرونت.
 */

import { z } from 'zod';
import { paginationSchema } from './common';

export const notificationTypeEnum = z.enum([
  'CREDIT_LIMIT_EXCEEDED',
  'GRACE_PERIOD_ENDING',
  'CUSTOMER_INACTIVE',
  'CUSTOMER_DEBT_HIGH',
]);
export type NotificationTypeZ = z.infer<typeof notificationTypeEnum>;

export const listNotificationsQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(false),
  type: notificationTypeEnum.optional(),
});
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

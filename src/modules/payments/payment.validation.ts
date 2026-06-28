import { z } from 'zod';

export const createPaymentSchema = z.object({
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
  amount: z.number().positive(),
  paymentType: z.enum(['mobile_money', 'bank', 'cash', 'card']).default('mobile_money'),
  phoneNumber: z.string().min(7).max(20).optional(),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const snippeWebhookSchema = z.object({
  providerReference: z.string().min(1),
  internalReference: z.string().optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']),
  amount: z.number().positive(),
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

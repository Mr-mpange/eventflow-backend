import { z } from 'zod';
import { McpToolName } from './mcp.types';

export const mcpToolSchemas: Record<McpToolName, z.ZodTypeAny> = {
  getGuestContext: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
  }),
  getEventDetails: z.object({
    eventCode: z.string().min(1),
  }),
  getGuestBalance: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
  }),
  updateRSVP: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
    status: z.enum(['ACCEPTED', 'DECLINED', 'MAYBE']),
    note: z.string().max(500).optional(),
    plusOnes: z.number().int().min(0).max(10).optional(),
  }),
  createPaymentRequest: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
    amount: z.number().positive(),
    paymentType: z.enum(['mobile_money', 'bank', 'cash', 'card']).default('mobile_money'),
    idempotencyKey: z.string().min(8).max(128).optional(),
  }),
  checkPaymentStatus: z.object({
    internalReference: z.string().min(1),
  }),
  recordPledge: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
    amount: z.number().positive(),
    promisedDate: z.string().datetime(),
    notes: z.string().max(500).optional(),
  }),
  sendInvitationCard: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
  }),
  issueTicket: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
  }),
  sendPaymentReminder: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
  }),
  verifyQRCode: z.object({
    ticketToken: z.string().min(1),
  }),
  getEventAnalytics: z.object({
    eventCode: z.string().min(1),
  }),
  handoffToOrganizer: z.object({
    eventCode: z.string().min(1),
    guestPhone: z.string().min(7).max(20),
    reason: z.string().min(1).max(500),
  }),
};

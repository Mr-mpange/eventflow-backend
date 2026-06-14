import { z } from 'zod';

export const sendMessageSchema = z.object({
  guestId: z.string().uuid(),
  message: z.string().min(1).max(4096),
});

export const bulkMessageSchema = z.object({
  eventId: z.string().uuid(),
  message: z.string().min(1).max(4096),
  guestIds: z.array(z.string().uuid()).optional(),
  groupId: z.string().uuid().optional(),
});

export const scheduleCampaignSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(4096),
  templateId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  guestIds: z.array(z.string().uuid()).optional(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  language: z.string().default('en'),
  category: z.string().optional(),
  content: z.record(z.unknown()),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
export type BulkMessageDto = z.infer<typeof bulkMessageSchema>;
export type ScheduleCampaignDto = z.infer<typeof scheduleCampaignSchema>;

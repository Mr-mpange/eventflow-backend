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

/**
 * Send invitation template to a single guest.
 * imageUrl overrides the event's coverImageUrl for this specific guest.
 */
export const sendInvitationSchema = z.object({
  language: z.enum(['en', 'sw']).default('sw'),
  imageUrl: z.string().url().optional(), // per-guest image override
});

/**
 * Bulk invitation schema — sends the approved WhatsApp template to multiple guests.
 * imageUrl         → one image for everyone (fallback: event.coverImageUrl)
 * imageUrls        → map of { [guestId]: imageUrl } for per-guest images
 * When both are provided, imageUrls takes precedence per guest; imageUrl is the fallback.
 */
export const bulkInviteSchema = z.object({
  eventId: z.string().uuid(),
  language: z.enum(['en', 'sw']).default('sw'),
  guestIds: z.array(z.string().uuid()).optional(),
  groupId: z.string().uuid().optional(),
  imageUrl: z.string().url().optional(),
  imageUrls: z.record(z.string().uuid(), z.string().url()).optional(),
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
export type SendInvitationDto = z.infer<typeof sendInvitationSchema>;
export type BulkInviteDto = z.infer<typeof bulkInviteSchema>;
export type ScheduleCampaignDto = z.infer<typeof scheduleCampaignSchema>;

import { z } from 'zod';

export const createInvitationSchema = z.object({
  eventId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  content: z.record(z.unknown()).default({}),
});

export const updateInvitationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.record(z.unknown()).optional(),
  templateId: z.string().uuid().optional(),
});

export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;
export type UpdateInvitationDto = z.infer<typeof updateInvitationSchema>;

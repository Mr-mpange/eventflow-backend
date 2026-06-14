import { z } from 'zod';

export const createGuestSchema = z.object({
  eventId: z.string().uuid(),
  fullName: z.string().min(1).max(200),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  groupId: z.string().uuid().optional(),
  plusOnes: z.number().int().min(0).max(10).default(0),
});

export const updateGuestSchema = createGuestSchema.omit({ eventId: true }).partial();

export const listGuestsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  groupId: z.string().uuid().optional(),
  rsvpStatus: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'MAYBE']).optional(),
});

export const createGroupSchema = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export type CreateGuestDto = z.infer<typeof createGuestSchema>;
export type UpdateGuestDto = z.infer<typeof updateGuestSchema>;

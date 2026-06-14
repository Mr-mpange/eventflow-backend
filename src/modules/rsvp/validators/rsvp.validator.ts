import { z } from 'zod';

export const rsvpResponseSchema = z.object({
  qrCode: z.string().uuid(),
  status: z.enum(['ACCEPTED', 'DECLINED', 'MAYBE']),
  note: z.string().max(500).optional(),
  plusOnes: z.number().int().min(0).max(10).default(0),
});

export type RsvpResponseDto = z.infer<typeof rsvpResponseSchema>;

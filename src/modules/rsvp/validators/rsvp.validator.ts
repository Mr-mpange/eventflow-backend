import { z } from 'zod';
import { extractUrlPathToken } from '@/shared/utils/helpers';

export const rsvpResponseSchema = z.object({
  qrCode: z.preprocess(
    (value) => (typeof value === 'string' ? extractUrlPathToken(value) : value),
    z.string().uuid(),
  ),
  status: z.enum(['ACCEPTED', 'DECLINED', 'MAYBE']),
  note: z.string().max(500).optional(),
  plusOnes: z.number().int().min(0).max(10).default(0),
});

export type RsvpResponseDto = z.infer<typeof rsvpResponseSchema>;

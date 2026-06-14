import { Router } from 'express';
import { rsvpController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { rsvpResponseSchema } from '../validators/rsvp.validator';
import { z } from 'zod';

const router = Router();

const qrBodySchema = z.object({
  qrCode: z.string().uuid(),
  note: z.string().max(500).optional(),
  plusOnes: z.number().int().min(0).max(10).optional(),
});

// Public RSVP endpoints (guest-facing)
router.post('/respond', validate(rsvpResponseSchema), rsvpController.respond);
router.post('/accept', validate(qrBodySchema), rsvpController.accept);
router.post('/decline', validate(qrBodySchema.omit({ plusOnes: true })), rsvpController.decline);
router.post('/maybe', validate(qrBodySchema), rsvpController.maybe);

// Protected analytics
router.get('/analytics/:eventId', authenticate, rsvpController.analytics);

export default router;

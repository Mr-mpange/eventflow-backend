import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { pledgeController } from '@/shared/container';

const router = Router();

const createSchema = z.object({
  eventId: z.string().uuid(),
  guestId: z.string().uuid(),
  amount: z.number().positive(),
  promisedDate: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

const updateSchema = z.object({
  status: z.enum(['ACTIVE', 'PAID', 'MISSED', 'CANCELLED']),
});

router.post('/pledges', authenticate, validate(createSchema), pledgeController.create);
router.get('/events/:eventId/pledges', authenticate, pledgeController.listByEvent);
router.patch('/pledges/:id/status', authenticate, validate(updateSchema), pledgeController.updateStatus);

export default router;

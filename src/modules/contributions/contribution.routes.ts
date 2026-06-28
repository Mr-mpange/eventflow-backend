import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { contributionController } from '@/shared/container';

const router = Router();

const updateSchema = z.object({
  requiredAmount: z.number().nonnegative().optional(),
  paidAmount: z.number().nonnegative().optional(),
  status: z.enum(['UNPAID', 'PARTIAL', 'COMPLETED', 'WAIVED']).optional(),
});

router.get('/events/:eventId/contributions', authenticate, contributionController.listByEvent);
router.get('/events/:eventId/guests/:guestId/balance', authenticate, contributionController.getBalance);
router.patch('/events/:eventId/guests/:guestId/contribution', authenticate, validate(updateSchema), contributionController.update);

export default router;

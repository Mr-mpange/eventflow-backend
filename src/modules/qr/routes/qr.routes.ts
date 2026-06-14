import { Router } from 'express';
import { z } from 'zod';
import { qrController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';

const router = Router();

router.use(authenticate);

router.post('/generate/:guestId', qrController.generate);
router.get('/verify/:qrCode', qrController.verify);
router.post('/check-in', validate(z.object({
  qrCode: z.string().uuid(),
  notes: z.string().max(500).optional(),
})), qrController.checkIn);
router.get('/attendance/:eventId', qrController.attendanceLogs);

export default router;

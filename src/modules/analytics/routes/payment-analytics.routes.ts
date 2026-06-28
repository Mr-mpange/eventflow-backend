import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { analyticsController } from '@/shared/container';

const router = Router();

router.get('/events/:eventId/payment-analytics', authenticate, analyticsController.paymentAnalytics);

export default router;

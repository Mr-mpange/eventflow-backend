import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { webhookRateLimiter } from '@/middleware/rateLimiter';
import { paymentController } from '@/shared/container';
import { createPaymentSchema, snippeWebhookSchema } from './payment.validation';

const router = Router();

router.post('/payments/create', authenticate, validate(createPaymentSchema), paymentController.create);
router.get('/payments/:id/status', authenticate, paymentController.getStatus);
router.get('/events/:eventId/payments', authenticate, paymentController.listByEvent);
router.post('/webhooks/snippe', webhookRateLimiter, validate(snippeWebhookSchema), paymentController.handleWebhook);

export default router;

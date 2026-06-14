import { Router } from 'express';
import { subscriptionController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { upgradePlanSchema } from '../validators/subscription.validator';

const router = Router();

router.get('/plans', subscriptionController.getPlans);
router.use(authenticate);
router.get('/', subscriptionController.getSubscription);
router.post('/upgrade', validate(upgradePlanSchema), subscriptionController.upgradePlan);
router.get('/invoices', subscriptionController.getInvoices);

export default router;

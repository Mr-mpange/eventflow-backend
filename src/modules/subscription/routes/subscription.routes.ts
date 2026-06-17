import { Router } from 'express';
import { subscriptionController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { upgradePlanSchema } from '../validators/subscription.validator';

const router = Router();

/**
 * @swagger
 * /subscriptions/plans:
 *   get:
 *     tags: [Subscriptions]
 *     summary: List all available subscription plans
 *     responses:
 *       200:
 *         description: Plan list with features and pricing
 *
 * /subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get your current subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current plan details
 *
 * /subscriptions/upgrade:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Upgrade your subscription plan
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan]
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [FREE, BASIC, PREMIUM, ENTERPRISE]
 *     responses:
 *       200:
 *         description: Plan upgraded
 *
 * /subscriptions/invoices:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get billing invoices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invoice history
 */
router.get('/plans', subscriptionController.getPlans);
router.use(authenticate);
router.get('/', subscriptionController.getSubscription);
router.post('/upgrade', validate(upgradePlanSchema), subscriptionController.upgradePlan);
router.get('/invoices', subscriptionController.getInvoices);

export default router;

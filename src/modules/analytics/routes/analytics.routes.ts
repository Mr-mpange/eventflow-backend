import { Router } from 'express';
import { analyticsController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /analytics/event/{eventId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Overall event analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event analytics summary
 *
 * /analytics/rsvp/{eventId}:
 *   get:
 *     tags: [Analytics]
 *     summary: RSVP statistics for an event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: RSVP breakdown (accepted, declined, maybe, pending)
 *
 * /analytics/attendance/{eventId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Attendance statistics for an event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check-in counts and logs
 *
 * /analytics/messages/{eventId}:
 *   get:
 *     tags: [Analytics]
 *     summary: WhatsApp message delivery stats for an event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message sent/delivered/failed counts
 */
router.get('/event/:eventId', analyticsController.eventAnalytics);
router.get('/rsvp/:eventId', analyticsController.rsvpStats);
router.get('/attendance/:eventId', analyticsController.attendanceStats);
router.get('/messages/:eventId', analyticsController.messageStats);
router.get('/events/:eventId/payment-analytics', analyticsController.paymentAnalytics);

export default router;

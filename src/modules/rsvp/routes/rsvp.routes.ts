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

/**
 * @swagger
 * /rsvp/respond:
 *   post:
 *     tags: [RSVP]
 *     summary: Submit RSVP response (public — no auth needed)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guestId, status]
 *             properties:
 *               guestId:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, DECLINED, MAYBE]
 *               note:
 *                 type: string
 *               plusOnes:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10
 *     responses:
 *       200:
 *         description: RSVP recorded
 *
 * /rsvp/accept:
 *   post:
 *     tags: [RSVP]
 *     summary: Accept via QR code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCode]
 *             properties:
 *               qrCode:
 *                 type: string
 *                 format: uuid
 *               note:
 *                 type: string
 *               plusOnes:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Accepted
 *
 * /rsvp/decline:
 *   post:
 *     tags: [RSVP]
 *     summary: Decline via QR code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCode]
 *             properties:
 *               qrCode:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Declined
 *
 * /rsvp/maybe:
 *   post:
 *     tags: [RSVP]
 *     summary: Maybe via QR code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrCode]
 *             properties:
 *               qrCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Maybe recorded
 *
 * /rsvp/analytics/{eventId}:
 *   get:
 *     tags: [RSVP]
 *     summary: Get RSVP analytics for an event
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
 *         description: RSVP statistics
 */
router.post('/respond', validate(rsvpResponseSchema), rsvpController.respond);
router.post('/accept', validate(qrBodySchema), rsvpController.accept);
router.post('/decline', validate(qrBodySchema.omit({ plusOnes: true })), rsvpController.decline);
router.post('/maybe', validate(qrBodySchema), rsvpController.maybe);
router.get('/analytics/:eventId', authenticate, rsvpController.analytics);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import { qrController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { extractUrlPathToken } from '@/shared/utils/helpers';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /qr/generate/{guestId}:
 *   post:
 *     tags: [QR]
 *     summary: Generate QR code for a guest
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR code generated and uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 *                 qrCodeUrl:
 *                   type: string
 *
 * /qr/verify/{qrCode}:
 *   get:
 *     tags: [QR]
 *     summary: Verify a QR code (check-in validation)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR code valid — returns guest and event info
 *
 * /qr/check-in:
 *   post:
 *     tags: [QR]
 *     summary: Check in a guest by scanning their QR code
 *     security:
 *       - bearerAuth: []
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
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Guest checked in
 *
 * /qr/attendance/{eventId}:
 *   get:
 *     tags: [QR]
 *     summary: Get attendance logs for an event
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
 *         description: Attendance log list
 */
router.post('/generate/:guestId', qrController.generate);
router.get('/verify/:qrCode', qrController.verify);
router.post('/check-in', validate(z.object({
  qrCode: z.preprocess(
    (value) => (typeof value === 'string' ? extractUrlPathToken(value) : value),
    z.string().uuid(),
  ),
  notes: z.string().max(500).optional(),
})), qrController.checkIn);
router.get('/attendance/:eventId', qrController.attendanceLogs);

export default router;

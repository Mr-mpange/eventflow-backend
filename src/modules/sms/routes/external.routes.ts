import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { authenticateApiKey, requirePermission, ApiKeyRequest } from '@/middleware/apiKey';
import { externalApiRateLimiter } from '@/middleware/rateLimiter';
import { briqSmsService } from '@/infrastructure/sms/BriqSmsService';

const router = Router();

router.use(externalApiRateLimiter);
router.use(authenticateApiKey);

const sendSmsSchema = z.object({
  to: z.string().min(7).max(20),
  message: z.string().min(1).max(1600),
  senderId: z.string().min(1).max(32).optional(),
});

/**
 * @swagger
 * /external/sms/send:
 *   post:
 *     tags: [External SMS API]
 *     summary: Send a normal SMS via Briq
 *     description: |
 *       Sends a standard SMS message through the configured Briq account.
 *
 *       ### Requirements
 *       - Phone number should be in E.164 format, e.g. `+255712345678`
 *       - Briq SMS credentials must be configured on the server
 *       - Your API key must include the `send_message` permission
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, message]
 *             properties:
 *               to:
 *                 type: string
 *                 example: "+255712345678"
 *               message:
 *                 type: string
 *                 maxLength: 1600
 *                 example: "Your invitation has been confirmed. See you at 4 PM."
 *               senderId:
 *                 type: string
 *                 description: Optional override for the default configured Briq sender ID
 *                 example: "EventFlow"
 *     responses:
 *       202:
 *         description: SMS accepted by the provider
 *       400:
 *         description: Validation error or Briq SMS is not configured
 *       401:
 *         description: Missing or invalid API key
 *       403:
 *         description: API key lacks `send_message` permission
 *       502:
 *         description: Briq rejected the request or returned an upstream error
 */
router.post(
  '/send',
  requirePermission('send_message'),
  validate(sendSmsSchema),
  async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const { to, message, senderId } = req.body as z.infer<typeof sendSmsSchema>;
      const result = await briqSmsService.sendMessage({ to, message, senderId });

      res.status(202).json({
        success: true,
        data: {
          messageId: result.externalId,
          status: result.status,
          providerStatus: result.providerStatus ?? null,
          to,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;

import { Router, Request, Response } from 'express';
import { ghalaRailsService } from '@/infrastructure/whatsapp/GhalaRailsService';
import { prisma } from '@/config/database';
import { MessageStatus } from '@prisma/client';
import { agentService } from '@/shared/container';

const router = Router();

/**
 * GET /webhook/whatsapp
 * GhalaRails webhook verification handshake.
 * GhalaRails (and Meta) hit this to confirm the callback URL is valid.
 */
router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === ghalaRailsService.webhookVerifyToken) {
    console.log('[Webhook] Verification successful');
    return res.status(200).send(challenge);
  }

  console.warn('[Webhook] Verification failed — token mismatch');
  return res.status(403).json({ error: 'Forbidden' });
});

/**
 * POST /webhook/whatsapp
 * Receives forwarded WhatsApp events from GhalaRails.
 * Handles message delivery status updates.
 */
router.post('/', async (req: Request, res: Response) => {
  // Acknowledge immediately — GhalaRails expects a fast 200
  res.sendStatus(200);

  try {
    const body = req.body as Record<string, unknown>;

    // GhalaRails forwards Meta's webhook payload structure
    const entry = (body.entry as Array<{
      changes: Array<{
        value: {
          statuses?: Array<{ id: string; status: string; errors?: unknown[] }>;
          messages?: Array<{ id: string; from: string; type: string; text?: { body: string } }>;
        };
      }>;
    }>)?.[0];

    if (!entry) return;

    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Handle delivery status updates
      for (const statusUpdate of value.statuses ?? []) {
        const { id: externalId, status } = statusUpdate;

        const messageStatus: MessageStatus =
          status === 'delivered'
            ? MessageStatus.DELIVERED
            : status === 'read'
              ? MessageStatus.READ
              : status === 'failed'
                ? MessageStatus.FAILED
                : MessageStatus.SENT;

        await prisma.whatsAppMessage.updateMany({
          where: { externalId },
          data: { status: messageStatus },
        });
      }

      // Log inbound messages (optional — for future inbox feature)
      for (const msg of value.messages ?? []) {
        const messageText = msg.text?.body?.trim();
        console.log(
          `[Webhook] Inbound from ${msg.from}: ${msg.text?.body ?? `[${msg.type}]`}`,
        );

        if (!messageText) continue;

        void agentService.handleMessage({
          message: messageText,
          phoneNumber: msg.from,
          channel: 'WHATSAPP',
          sarufiAgentId: process.env.SARUFI_AGENT_ID,
        }).catch((error) => {
          console.error('[Webhook] Agent bridge error:', error);
        });
      }
    }
  } catch (err) {
    console.error('[Webhook] Error processing event:', err);
  }
});

export default router;

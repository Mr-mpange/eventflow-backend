import { Router } from 'express';
import { z } from 'zod';
import { agentRateLimiter } from '@/middleware/rateLimiter';
import { validate } from '@/middleware/validate';
import { agentController } from '@/shared/container';
import { authenticateSarufi } from '@modules/sarufi/sarufi.auth';
import { AGENT_INTENTS } from './intent.types';

const router = Router();

const schema = z.object({
  eventCode: z.string().optional(),
  phoneNumber: z.string().min(7).max(20).optional(),
  inviteCode: z.string().optional(),
  guestId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
  intent: z.enum(AGENT_INTENTS).optional(),
  channel: z.enum(['WHATSAPP', 'SMS', 'WEB']).optional(),
  language: z.enum(['SW', 'EN']).optional(),
  amount: z.number().positive().optional(),
  promisedDate: z.string().datetime().optional(),
  paymentReference: z.string().optional(),
  sarufiAgentId: z.string().optional(),
  agentId: z.string().optional(),
  chatbotId: z.string().optional(),
  workspaceId: z.string().optional(),
  conversationId: z.string().optional(),
  userPhone: z.string().min(7).max(20).optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

router.post('/agent/message', agentRateLimiter, authenticateSarufi, validate(schema), agentController.message);

export default router;

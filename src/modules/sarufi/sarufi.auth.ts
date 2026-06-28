import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Response } from 'express';
import { AgentChannel } from '@prisma/client';
import { env } from '@/config/env';
import { UnauthorizedError } from '@/shared/errors/AppError';
import { SarufiRequest } from './sarufi.types';

function normalizeChannel(value: unknown): AgentChannel | undefined {
  if (typeof value !== 'string') return undefined;
  const upper = value.toUpperCase();
  if (upper === 'WHATSAPP' || upper === 'SMS' || upper === 'WEB') {
    return upper as AgentChannel;
  }
  return undefined;
}

function readAgentId(req: SarufiRequest): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;
  const headers = req.headers;
  return (
    (headers['x-sarufi-agent-id'] as string | undefined)
    ?? (headers['x-chatbot-id'] as string | undefined)
    ?? (typeof body?.sarufiAgentId === 'string' ? body.sarufiAgentId : undefined)
    ?? (typeof body?.agentId === 'string' ? body.agentId : undefined)
    ?? (typeof body?.chatbotId === 'string' ? body.chatbotId : undefined)
  );
}

function readWorkspaceId(req: SarufiRequest): string | undefined {
  const body = req.body as Record<string, unknown> | undefined;
  return (
    (req.headers['x-sarufi-workspace-id'] as string | undefined)
    ?? (typeof body?.workspaceId === 'string' ? body.workspaceId : undefined)
  );
}

function safeEqualHex(computed: string, received: string): boolean {
  const a = Buffer.from(computed);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authenticateSarufi(req: SarufiRequest, _res: Response, next: NextFunction): void {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const signature = (req.headers['x-sarufi-signature'] as string | undefined)
    ?? (req.headers['x-signature'] as string | undefined);
  const agentId = readAgentId(req);
  const workspaceId = readWorkspaceId(req);

  if (!agentId || !env.SARUFI_AGENT_ID || agentId !== env.SARUFI_AGENT_ID) {
    next(new UnauthorizedError('Unknown Sarufi agent'));
    return;
  }

  if (env.SARUFI_WORKSPACE_ID && workspaceId && workspaceId !== env.SARUFI_WORKSPACE_ID) {
    next(new UnauthorizedError('Unknown Sarufi workspace'));
    return;
  }

  let authMethod: 'bearer' | 'signature' | null = null;

  if (
    bearer
    && (
      (env.SARUFI_ACCESS_TOKEN && bearer === env.SARUFI_ACCESS_TOKEN)
      || (env.SARUFI_API_KEY && bearer === env.SARUFI_API_KEY)
    )
  ) {
    authMethod = 'bearer';
  } else if (signature && env.SARUFI_WEBHOOK_SECRET) {
    const computed = createHmac('sha256', env.SARUFI_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body ?? {}))
      .digest('hex');
    if (safeEqualHex(computed, signature)) {
      authMethod = 'signature';
    }
  }

  if (!authMethod) {
    next(new UnauthorizedError('Invalid Sarufi authentication'));
    return;
  }

  const body = req.body as Record<string, unknown> | undefined;
  req.sarufiContext = {
    agentId,
    workspaceId: workspaceId ?? env.SARUFI_WORKSPACE_ID,
    conversationId: (req.headers['x-conversation-id'] as string | undefined)
      ?? (typeof body?.conversationId === 'string' ? body.conversationId : undefined),
    channel: normalizeChannel(
      (req.headers['x-channel'] as string | undefined)
      ?? body?.channel,
    ),
    userPhone: (req.headers['x-user-phone'] as string | undefined)
      ?? (typeof body?.phoneNumber === 'string' ? body.phoneNumber : undefined)
      ?? (typeof body?.userPhone === 'string' ? body.userPhone : undefined),
    authMethod,
  };

  next();
}

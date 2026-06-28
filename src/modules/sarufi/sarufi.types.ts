import { Request } from 'express';
import { AgentChannel } from '@prisma/client';

export interface SarufiContext {
  agentId: string;
  workspaceId?: string;
  conversationId?: string;
  channel?: AgentChannel;
  userPhone?: string;
  authMethod: 'bearer' | 'signature';
}

export interface SarufiRequest extends Request {
  sarufiContext?: SarufiContext;
}

export interface SarufiOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

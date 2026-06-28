import { AgentChannel, AgentLanguage } from '@prisma/client';
import { AgentIntentName } from './intent.types';

export interface AgentMessageInput {
  eventCode?: string;
  phoneNumber?: string;
  inviteCode?: string;
  guestId?: string;
  message: string;
  intent?: AgentIntentName;
  channel?: AgentChannel;
  language?: AgentLanguage;
  amount?: number;
  promisedDate?: string;
  paymentReference?: string;
  sarufiAgentId?: string;
  workspaceId?: string;
  conversationId?: string;
  variables?: Record<string, unknown>;
}

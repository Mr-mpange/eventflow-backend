import { prisma } from '@/config/database';
import { AgentChannel, AgentIntent, AgentLanguage, AgentSender, AgentSessionStatus, Prisma } from '@prisma/client';

export class AgentRepository {
  findActiveSession(eventId: string, guestId: string, channel: AgentChannel) {
    return prisma.agentSession.findFirst({
      where: { eventId, guestId, channel, status: AgentSessionStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createSession(data: {
    eventId: string;
    guestId: string;
    channel: AgentChannel;
    language: AgentLanguage;
    currentIntent?: AgentIntent;
    currentStep?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.agentSession.create({ data });
  }

  updateSession(id: string, data: Prisma.AgentSessionUpdateInput) {
    return prisma.agentSession.update({ where: { id }, data });
  }

  createMessage(data: {
    sessionId: string;
    sender: AgentSender;
    message: string;
    intent?: AgentIntent;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.agentMessage.create({ data });
  }

  countSessionsByEvent(eventId: string) {
    return prisma.agentSession.count({ where: { eventId } });
  }
}

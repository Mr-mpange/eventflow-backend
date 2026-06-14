import { Prisma, AuditAction } from '@prisma/client';
import { prisma } from '@/config/database';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  async log(
    action: AuditAction,
    entityType: string,
    entityId: string | null,
    context: AuditContext,
    oldValues?: Record<string, unknown>,
    newValues?: Record<string, unknown>,
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        oldValues: oldValues ? (oldValues as Prisma.InputJsonValue) : undefined,
        newValues: newValues ? (newValues as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}

export const auditService = new AuditService();

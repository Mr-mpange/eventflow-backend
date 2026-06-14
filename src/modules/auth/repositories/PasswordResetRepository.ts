import { prisma } from '@/config/database';
import { PasswordReset } from '@prisma/client';

export class PasswordResetRepository {
  async create(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<PasswordReset> {
    return prisma.passwordReset.create({ data });
  }

  async findByToken(token: string): Promise<PasswordReset | null> {
    return prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async markUsed(id: string): Promise<void> {
    await prisma.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async invalidateForUser(userId: string): Promise<void> {
    await prisma.passwordReset.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}

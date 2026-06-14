import { prisma } from '@/config/database';
import { EmailVerification } from '@prisma/client';

export class EmailVerificationRepository {
  async create(data: {
    userId: string;
    token: string;
    expiresAt: Date;
  }): Promise<EmailVerification> {
    return prisma.emailVerification.create({ data });
  }

  async findByToken(token: string): Promise<EmailVerification | null> {
    return prisma.emailVerification.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async markUsed(id: string): Promise<void> {
    await prisma.emailVerification.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}

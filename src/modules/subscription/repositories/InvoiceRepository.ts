import { prisma } from '@/config/database';
import { Invoice, InvoiceStatus, Prisma } from '@prisma/client';

export class InvoiceRepository {
  async findBySubscription(subscriptionId: string) {
    return prisma.invoice.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Invoice | null> {
    return prisma.invoice.findUnique({ where: { id } });
  }

  async create(data: Prisma.InvoiceCreateInput): Promise<Invoice> {
    return prisma.invoice.create({ data });
  }

  async markPaid(id: string, stripeInvoiceId?: string): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        ...(stripeInvoiceId ? { stripeInvoiceId } : {}),
      },
    });
  }
}

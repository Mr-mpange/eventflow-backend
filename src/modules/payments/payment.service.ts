import { PaymentStatus, Prisma } from '@prisma/client';
import { getRedis } from '@/config/redis';
import { auditService } from '@/shared/services/AuditService';
import { generateToken } from '@/shared/utils/helpers';
import { ForbiddenError, NotFoundError, ValidationError } from '@/shared/errors/AppError';
import { EventRepository } from '@modules/event/repositories/EventRepository';
import { GuestRepository } from '@modules/guest/repositories/GuestRepository';
import { CardService } from '@modules/cards/card.service';
import { ContributionService } from '@modules/contributions/contribution.service';
import { PledgeService } from '@modules/pledges/pledge.service';
import { PaymentRepository } from './payment.repository';
import { snippeProvider } from './snippe.provider';
import { CreatePaymentInput, mapPayment, SnippeWebhookPayload } from './payment.types';

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly eventRepo: EventRepository,
    private readonly guestRepo: GuestRepository,
    private readonly contributionService: ContributionService,
    private readonly cardService: CardService,
    private readonly pledgeService: PledgeService,
  ) {}

  private async assertEventAccess(eventId: string, userId: string) {
    const event = await this.eventRepo.findById(eventId);
    if (!event) throw new NotFoundError('Event', eventId);
    if (event.organizerId !== userId) throw new ForbiddenError();
    return event;
  }

  async createPaymentRequest(userId: string, input: CreatePaymentInput) {
    const [event, guest, balance] = await Promise.all([
      this.assertEventAccess(input.eventId, userId),
      this.guestRepo.findById(input.guestId),
      this.contributionService.getBalance(input.eventId, input.guestId),
    ]);

    if (!guest || guest.eventId !== input.eventId) throw new NotFoundError('Guest', input.guestId);
    if (balance.status === 'COMPLETED' || balance.status === 'WAIVED') {
      throw new ValidationError('Guest contribution is already complete');
    }
    if (input.amount > balance.remainingAmount && balance.remainingAmount > 0) {
      throw new ValidationError('Payment amount exceeds remaining balance');
    }

    const internalReference = input.idempotencyKey
      ? `PAY-${input.idempotencyKey}`
      : `PAY-${generateToken(6).toUpperCase()}`;

    const existing = await this.paymentRepo.findByInternalReference(internalReference);
    if (existing) return {
      success: true,
      message: 'Payment request already exists',
      checkoutUrl: existing.checkoutUrl,
      amount: Number(existing.amount),
      currency: existing.currency,
      reference: existing.internalReference,
    };

    const providerResult = await snippeProvider.createPaymentRequest({
      amount: input.amount,
      currency: 'TZS',
      reference: internalReference,
      phoneNumber: input.phoneNumber ?? guest.phone ?? undefined,
      paymentType: input.paymentType,
      webhookUrl: `${process.env.API_PUBLIC_URL ?? 'https://eventflow-backend-614505894752.us-central1.run.app'}/api/v1/webhooks/snippe`,
      customer: {
        firstname: guest.fullName.split(' ')[0] ?? guest.fullName,
        lastname: guest.fullName.split(' ').slice(1).join(' ') || guest.fullName,
        email: guest.email ?? undefined,
      },
      metadata: {
        eventId: event.id,
        guestId: guest.id,
        organizerId: event.organizerId,
      },
    });

    const payment = await this.paymentRepo.create({
      event: { connect: { id: input.eventId } },
      guest: { connect: { id: input.guestId } },
      organizer: { connect: { id: userId } },
      amount: input.amount,
      currency: 'TZS',
      status: PaymentStatus.PENDING,
      provider: 'SNIPPE',
      providerReference: providerResult.providerReference,
      internalReference,
      checkoutUrl: providerResult.checkoutUrl,
      phoneNumber: input.phoneNumber ?? guest.phone ?? null,
      paymentType: input.paymentType,
      metadata: (providerResult.metadata ?? {}) as Prisma.InputJsonValue,
    });

    await auditService.log('CREATE', 'Payment', payment.id, { userId }, undefined, {
      internalReference,
      amount: input.amount,
      guestId: input.guestId,
    });

    return {
      success: true,
      message: 'Payment request created',
      checkoutUrl: payment.checkoutUrl,
      amount: Number(payment.amount),
      currency: payment.currency,
      reference: payment.internalReference,
    };
  }

  async getStatus(id: string, userId?: string) {
    const payment = await this.paymentRepo.findById(id);
    if (!payment) throw new NotFoundError('Payment', id);
    if (userId) await this.assertEventAccess(payment.eventId, userId);
    return mapPayment(payment);
  }

  async getStatusByReference(internalReference: string) {
    const payment = await this.paymentRepo.findByInternalReference(internalReference);
    if (!payment) throw new NotFoundError('Payment');
    return mapPayment(payment);
  }

  async listByEvent(eventId: string, userId: string) {
    await this.assertEventAccess(eventId, userId);
    return this.paymentRepo.listByEvent(eventId);
  }

  async handleWebhook(payload: SnippeWebhookPayload, signature?: string, rawBody?: string) {
    if (!snippeProvider.verifySignature(payload, signature, rawBody)) {
      throw new ValidationError('Invalid Snippe signature');
    }

    const idempotencyKey = `snippe:webhook:${payload.providerReference}:${payload.status}:${payload.amount}`;
    const redis = getRedis();
    const seen = await redis.get(idempotencyKey);
    if (seen) {
      return { duplicated: true };
    }

    const payment = payload.internalReference
      ? await this.paymentRepo.findByInternalReference(payload.internalReference)
      : await this.paymentRepo.findByProviderReference(payload.providerReference);

    if (!payment) throw new NotFoundError('Payment');
    if (payment.eventId !== payload.eventId || payment.guestId !== payload.guestId) {
      throw new ValidationError('Webhook payload does not match payment context');
    }
    if (Number(payment.amount) !== payload.amount) {
      throw new ValidationError('Webhook amount does not match payment amount');
    }
    if (payment.status === PaymentStatus.PAID && payload.status === 'PAID') {
      await redis.setex(idempotencyKey, 24 * 60 * 60, '1');
      return { duplicated: true, payment: mapPayment(payment) };
    }

    const updated = await this.paymentRepo.update(payment.id, {
      status: payload.status,
      providerReference: payload.providerReference,
      paidAt: payload.status === 'PAID' ? new Date() : undefined,
      failedReason: payload.status === 'FAILED' ? 'Provider reported failure' : undefined,
      metadata: (payload.metadata ?? {}) as Prisma.InputJsonValue,
    });

    await auditService.log('UPDATE', 'Payment', updated.id, {}, { status: payment.status }, { status: payload.status });

    if (payload.status === 'PAID') {
      const balance = await this.contributionService.applyPayment(payment.eventId, payment.guestId, payload.amount, {
        userId: payment.organizerId,
      });
      await this.pledgeService.markCompletedForGuest(payment.eventId, payment.guestId);

      await this.cardService.sendPaymentConfirmationCard(payment.eventId, payment.guestId, payload.amount, balance.remainingAmount);
    }

    await redis.setex(idempotencyKey, 24 * 60 * 60, '1');
    return { duplicated: false, payment: mapPayment(updated) };
  }
}

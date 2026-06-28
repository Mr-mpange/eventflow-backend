import { Payment, PaymentStatus } from '@prisma/client';

export interface CreatePaymentInput {
  eventId: string;
  guestId: string;
  amount: number;
  paymentType: string;
  phoneNumber?: string;
  idempotencyKey?: string;
}

export interface SnippeWebhookPayload {
  providerReference: string;
  internalReference?: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
  amount: number;
  eventId: string;
  guestId: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentStatusResponse {
  id: string;
  internalReference: string;
  providerReference: string | null;
  status: PaymentStatus;
  amount: number;
  currency: string;
  checkoutUrl: string | null;
}

export function mapPayment(payment: Payment): PaymentStatusResponse {
  return {
    id: payment.id,
    internalReference: payment.internalReference,
    providerReference: payment.providerReference ?? null,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    checkoutUrl: payment.checkoutUrl ?? null,
  };
}

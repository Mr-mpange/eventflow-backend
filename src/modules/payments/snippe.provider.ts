import { createHmac } from 'crypto';
import { env } from '@/config/env';
import { generateToken } from '@/shared/utils/helpers';

export interface SnippeCreateRequest {
  amount: number;
  currency: string;
  reference: string;
  phoneNumber?: string;
  paymentType: string;
  webhookUrl: string;
  customer: {
    firstname: string;
    lastname: string;
    email?: string;
  };
  metadata: Record<string, unknown>;
}

export interface SnippeCreateResponse {
  providerReference: string;
  checkoutUrl: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  metadata?: Record<string, unknown>;
}

function pickString(data: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }

  for (const nestedKey of ['data', 'result', 'payload']) {
    const nested = data[nestedKey];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const nestedValue = pickString(nested as Record<string, unknown>, keys);
      if (nestedValue) return nestedValue;
    }
  }

  return '';
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function canonicalJson(input: unknown): string {
  if (typeof input === 'string') {
    try {
      return JSON.stringify(sortValue(JSON.parse(input)));
    } catch {
      return input;
    }
  }

  try {
    return JSON.stringify(sortValue(input));
  } catch {
    return String(input);
  }
}

function normalizeSignature(signature: string): string {
  return signature.replace(/^sha256=/i, '').trim().toLowerCase();
}

export class SnippeProvider {
  private readonly baseUrl = env.SNIPPE_BASE_URL;
  private readonly apiKey = env.SNIPPE_API_KEY;
  private readonly webhookSecret = env.SNIPPE_WEBHOOK_SECRET;

  async createPaymentRequest(input: SnippeCreateRequest): Promise<SnippeCreateResponse> {
    if (!this.baseUrl || !this.apiKey) {
      const providerReference = `mock-snippe-${generateToken(6)}`;
      return {
        providerReference,
        checkoutUrl: `${env.APP_PUBLIC_URL}/mock-checkout/${providerReference}`,
        status: 'PENDING',
        metadata: { mock: true },
      };
    }

    const response = await fetch(new URL('/v1/payments', this.baseUrl).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        webhook_url: input.webhookUrl,
        phone_number: input.phoneNumber,
        details: {
          amount: input.amount,
          currency: input.currency,
          reference: input.reference,
          payment_type: input.paymentType,
        },
        customer: input.customer,
        metadata: input.metadata,
      }),
    });

    const rawBody = await response.text();
    let data: Record<string, unknown> = {};
    try {
      data = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
    } catch {
      data = { message: rawBody };
    }

    if (!response.ok) {
      throw new Error(typeof data.message === 'string' ? data.message : rawBody || 'Snippe request failed');
    }

    const providerReference = pickString(data, [
      'providerReference',
      'provider_reference',
      'reference',
      'payment_reference',
      'id',
    ]);
    const checkoutUrl =
      pickString(data, ['checkoutUrl', 'checkout_url', 'paymentLink', 'payment_link', 'url', 'link']) ||
      (providerReference ? new URL(`/v1/payments/${providerReference}`, this.baseUrl).toString() : '');

    return {
      providerReference,
      checkoutUrl,
      status: String(data.status ?? 'PENDING') as SnippeCreateResponse['status'],
      metadata: data,
    };
  }

  verifySignature(payload: unknown, signature?: string, rawBody?: string) {
    if (!this.webhookSecret || !signature) return true;
    const body =
      typeof rawBody === 'string' && rawBody.trim()
        ? rawBody
        : JSON.stringify(payload);

    const secretCandidates = [
      this.webhookSecret,
      this.webhookSecret.trim(),
      this.webhookSecret.replace(/\r?\n/g, ''),
    ];
    const bodyCandidates = [
      body,
      body.trim(),
      body.replace(/\r\n/g, '\n'),
      canonicalJson(body),
      canonicalJson(payload),
    ];
    const expected = normalizeSignature(signature);

    for (const secret of secretCandidates) {
      for (const candidateBody of bodyCandidates) {
        const computed = createHmac('sha256', secret).update(candidateBody).digest('hex');
        if (normalizeSignature(computed) === expected) return true;
      }
    }

    return false;
  }
}

export const snippeProvider = new SnippeProvider();

import { env } from '@/config/env';
import { AppError, ValidationError } from '@/shared/errors/AppError';

export interface BriqSmsPayload {
  to: string;
  message: string;
  senderId?: string;
}

export interface BriqSmsResult {
  externalId: string;
  status: 'queued' | 'sent' | 'failed';
  providerStatus?: string;
}

type JsonRecord = Record<string, unknown>;

export class BriqSmsService {
  private readonly baseUrl: string;
  private readonly sendPath: string;
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly authHeader: string;
  private readonly authScheme: string;

  constructor() {
    this.baseUrl = env.BRIQ_SMS_BASE_URL ?? 'https://karibu.briq.tz';
    this.sendPath = env.BRIQ_SMS_SEND_PATH ?? '/v1/message/send-instant';
    this.apiKey = env.BRIQ_SMS_API_KEY ?? '';
    this.senderId = env.BRIQ_SMS_SENDER_ID ?? 'BRIQ';
    this.authHeader = env.BRIQ_SMS_AUTH_HEADER ?? 'X-API-Key';
    this.authScheme = env.BRIQ_SMS_AUTH_SCHEME ?? '';
  }

  private get endpoint(): string {
    return new URL(this.sendPath, this.baseUrl).toString();
  }

  private get headers(): Record<string, string> {
    const value = this.authHeader.toLowerCase() === 'authorization'
      ? `${this.authScheme} ${this.apiKey}`.trim()
      : this.apiKey;

    return {
      'Content-Type': 'application/json',
      [this.authHeader]: value,
    };
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new ValidationError(
        'Briq SMS is not configured. Set BRIQ_SMS_BASE_URL and BRIQ_SMS_API_KEY.',
      );
    }
  }

  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  private extractField(data: unknown, keys: string[]): string {
    if (!data || typeof data !== 'object') return '';

    for (const key of keys) {
      const value = (data as JsonRecord)[key];
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
      }
    }

    for (const nestedKey of ['data', 'result']) {
      const nested = (data as JsonRecord)[nestedKey];
      if (nested && typeof nested === 'object') {
        const found = this.extractField(nested, keys);
        if (found) return found;
      }
    }

    return '';
  }

  async sendMessage(payload: BriqSmsPayload): Promise<BriqSmsResult> {
    this.assertConfigured();

    const senderId = payload.senderId ?? this.senderId;
    const body = {
      content: payload.message,
      recipients: [payload.to],
      sender_id: senderId,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    const data = await this.readBody(response);

    if (!response.ok) {
      throw new AppError(
        502,
        'Briq SMS request failed',
        'PROVIDER_ERROR',
        typeof data === 'string' ? { providerMessage: data } : data,
      );
    }

    if (data && typeof data === 'object' && 'success' in (data as JsonRecord) && (data as JsonRecord).success === false) {
      throw new AppError(502, 'Briq SMS rejected the message', 'PROVIDER_ERROR', data);
    }

    const externalId = this.extractField(data, ['messageId', 'message_id', 'id', 'reference', 'requestId']);
    const providerStatus = this.extractField(data, ['status', 'messageStatus', 'state']);

    return {
      externalId,
      status: providerStatus === 'sent' ? 'sent' : 'queued',
      ...(providerStatus ? { providerStatus } : {}),
    };
  }
}

export const briqSmsService = new BriqSmsService();

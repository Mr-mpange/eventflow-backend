import { env } from '@/config/env';

export interface WhatsAppSendPayload {
  to: string;
  message: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface WhatsAppSendResult {
  externalId: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
}

export class GhalaRailsService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly phoneNumberId: string;

  constructor() {
    this.baseUrl = env.GHALA_RAILS_API_URL ?? 'https://api.ghalarails.com/v1';
    this.apiKey = env.GHALA_RAILS_API_KEY ?? '';
    this.phoneNumberId = env.GHALA_RAILS_PHONE_NUMBER_ID ?? '';
  }

  async sendMessage(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult> {
    if (!this.apiKey) {
      console.log(`[WhatsApp Dev] To: ${payload.to}, Message: ${payload.message.slice(0, 50)}...`);
      return { externalId: `dev-${Date.now()}`, status: 'sent' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          phone_number_id: this.phoneNumberId,
          to: payload.to,
          type: payload.templateName ? 'template' : 'text',
          message: payload.message,
          template: payload.templateName
            ? { name: payload.templateName, params: payload.templateParams }
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { externalId: '', status: 'failed', error };
      }

      const data = (await response.json()) as { id: string };
      return { externalId: data.id, status: 'sent' };
    } catch (error) {
      return {
        externalId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getDeliveryStatus(externalId: string): Promise<string> {
    if (!this.apiKey) return 'delivered';

    const response = await fetch(`${this.baseUrl}/messages/${externalId}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) return 'unknown';
    const data = (await response.json()) as { status: string };
    return data.status;
  }
}

export const ghalaRailsService = new GhalaRailsService();

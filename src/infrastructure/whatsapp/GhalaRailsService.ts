import { env } from '@/config/env';

export interface WhatsAppSendPayload {
  to: string; // phone number in E.164 format e.g. +255712345678
  message: string;
  templateName?: string;
  templateParams?: Record<string, string>;
}

export interface WhatsAppInvitationPayload {
  to: string;
  guestName: string;
  eventName: string;
  eventDate: string;
  location: string;
  rsvpLink: string;
  qrLink: string;
  language?: 'en' | 'sw';
  templateName?: string; // override — use exact template name if provided
  imageUrl?: string;     // public image URL for the template IMAGE header
}

export interface WhatsAppSendResult {
  externalId: string;
  status: 'sent' | 'queued' | 'failed';
  error?: string;
}

interface GhalaContact {
  id: number;
  phone_number: string;
}

export class GhalaRailsService {
  private readonly baseUrl: string;
  private readonly jwt: string;
  private readonly credentialId: number;
  readonly webhookVerifyToken: string;

  constructor() {
    this.baseUrl = env.GHALA_RAILS_API_URL ?? 'https://api.ghala.io';
    this.jwt = env.GHALA_RAILS_JWT ?? '';
    this.credentialId = env.GHALA_RAILS_CREDENTIAL_ID ?? 0;
    this.webhookVerifyToken = env.GHALA_RAILS_WEBHOOK_VERIFY_TOKEN ?? '';
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.jwt}`,
    };
  }

  /**
   * Ensure a contact exists in GhalaRails for the given phone number.
   * Returns the GhalaRails contact_id.
   */
  private async upsertContact(phone: string): Promise<number> {
    // Try to find existing contact first
    const searchRes = await fetch(
      `${this.baseUrl}/api/contacts?search=${encodeURIComponent(phone)}&credential_id=${this.credentialId}`,
      { headers: this.headers },
    );

    if (searchRes.ok) {
      const data = (await searchRes.json()) as {
        data: { contacts: GhalaContact[] };
      };
      const existing = data.data?.contacts?.find(
        (c) => c.phone_number === phone,
      );
      if (existing) return existing.id;
    }

    // Create contact if not found
    const createRes = await fetch(`${this.baseUrl}/api/contacts`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        phone_number: phone,
        source: 'manual',
        credential_id: this.credentialId,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create GhalaRails contact: ${err}`);
    }

    const created = (await createRes.json()) as { data: { id: number } };
    return created.data.id;
  }

  async sendMessage(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult> {
    if (!this.jwt || !this.credentialId) {
      console.log(
        `[WhatsApp Dev] To: ${payload.to}, Message: ${payload.message.slice(0, 50)}...`,
      );
      return { externalId: `dev-${Date.now()}`, status: 'sent' };
    }

    try {
      const contactId = await this.upsertContact(payload.to);

      let response: Response;

      if (payload.templateName) {
        // Template message
        response = await fetch(`${this.baseUrl}/api/messages/send-template`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            credential_id: this.credentialId,
            contact_id: contactId,
            template_name: payload.templateName,
            template_language: 'en',
            template_components: payload.templateParams
              ? [
                  {
                    type: 'body',
                    parameters: Object.values(payload.templateParams).map(
                      (v) => ({ type: 'text', text: v }),
                    ),
                  },
                ]
              : undefined,
          }),
        });
      } else {
        // Plain text message
        response = await fetch(`${this.baseUrl}/api/messages/send-text`, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            credential_id: this.credentialId,
            contact_id: contactId,
            text_content: payload.message,
          }),
        });
      }

      if (!response.ok) {
        const error = await response.text();
        return { externalId: '', status: 'failed', error };
      }

      const data = (await response.json()) as { data: { message_id: number } };
      return {
        externalId: String(data.data?.message_id ?? ''),
        status: 'queued',
      };
    } catch (error) {
      return {
        externalId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getDeliveryStatus(_externalId: string): Promise<string> {
    // GhalaRails delivers status updates via webhook callbacks
    // Pull-based status check is not exposed in the public API
    return 'unknown';
  }

  /**
   * Send the approved event_invitation_with_image template.
   * Falls back gracefully if the contact is not on WhatsApp.
   */
  async sendInvitationTemplate(payload: WhatsAppInvitationPayload): Promise<WhatsAppSendResult> {
    if (!this.jwt || !this.credentialId) {
      console.log(`[WhatsApp Dev] Invitation to: ${payload.to}`);
      return { externalId: `dev-${Date.now()}`, status: 'sent' };
    }

    try {
      const contactId = await this.upsertContact(payload.to);

      const lang = payload.language ?? 'en';
      // Use explicit templateName if provided, otherwise pick by language
      const templateName = payload.templateName
        ?? (lang === 'sw' ? 'eventflow_invite_sw' : 'eventflow_invite_en');
      const templateLanguage = lang === 'sw' ? 'sw' : 'en';

      const templateComponents: object[] = [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: payload.guestName },
            { type: 'text', text: payload.eventName },
            { type: 'text', text: payload.eventDate },
            { type: 'text', text: payload.location },
          ],
        },
      ];

      if (!payload.imageUrl) {
        return {
          externalId: '',
          status: 'failed',
          error: 'imageUrl is required for eventflow_invite templates (IMAGE header)',
        };
      }

      templateComponents.unshift({
        type: 'header',
        parameters: [{ type: 'image', image: { link: payload.imageUrl } }],
      });

      const buttonSuffix = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return '';
        try {
          const url = new URL(trimmed);
          const path = url.pathname.replace(/\/$/, '');
          return path.slice(path.lastIndexOf('/') + 1) || trimmed;
        } catch {
          return trimmed;
        }
      };

      // Only add button components if links are provided
      if (payload.rsvpLink) {
        templateComponents.push({
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: buttonSuffix(payload.rsvpLink) }],
        });
      }
      if (payload.qrLink) {
        templateComponents.push({
          type: 'button',
          sub_type: 'url',
          index: '1',
          parameters: [{ type: 'text', text: buttonSuffix(payload.qrLink) }],
        });
      }

      const response = await fetch(`${this.baseUrl}/api/messages/send-template`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          credential_id: this.credentialId,
          contact_id: contactId,
          template_name: templateName,
          template_language: templateLanguage,
          template_components: templateComponents,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { externalId: '', status: 'failed', error };
      }

      const data = (await response.json()) as { data: { message_id: number } };
      return {
        externalId: String(data.data?.message_id ?? ''),
        status: 'queued',
      };
    } catch (error) {
      return {
        externalId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const ghalaRailsService = new GhalaRailsService();

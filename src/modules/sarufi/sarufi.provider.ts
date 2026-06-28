import { env } from '@/config/env';
import { AgentIntentName } from '@modules/agent/intent.types';
import { SarufiOAuthTokenResponse } from './sarufi.types';

class SarufiProvider {
  private apiKey = env.SARUFI_API_KEY ?? '';
  private accessToken = env.SARUFI_ACCESS_TOKEN ?? '';
  private refreshToken = env.SARUFI_REFRESH_TOKEN ?? '';
  private tokenExpiresAt: number | null = null;

  private async refreshAccessToken(): Promise<void> {
    if (!env.SARUFI_BASE_URL || !this.refreshToken || !env.SARUFI_OAUTH_CLIENT_ID || !env.SARUFI_OAUTH_CLIENT_SECRET) {
      return;
    }

    const response = await fetch(new URL('/oauth/token', env.SARUFI_BASE_URL).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: env.SARUFI_OAUTH_CLIENT_ID,
        client_secret: env.SARUFI_OAUTH_CLIENT_SECRET,
      }),
    });

    if (!response.ok) return;
    const data = await response.json() as SarufiOAuthTokenResponse;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token ?? this.refreshToken;
    this.tokenExpiresAt = data.expires_in ? Date.now() + (data.expires_in * 1000) - 30_000 : null;
  }

  private async getAccessToken(): Promise<string> {
    if (this.apiKey) return this.apiKey;
    if (!this.accessToken) return '';
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt) {
      await this.refreshAccessToken();
    }
    return this.accessToken;
  }

  async sendTrace(payload: {
    intent: AgentIntentName;
    message: string;
    metadata?: Record<string, unknown>;
    conversationId?: string;
    channel?: string;
  }) {
    if (!env.SARUFI_BASE_URL || !env.SARUFI_AGENT_ID) return { success: true, mocked: true };

    const token = await this.getAccessToken();
    if (!token) return { success: true, mocked: true };

    await fetch(new URL(`/agents/${env.SARUFI_AGENT_ID}/traces`, env.SARUFI_BASE_URL).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspaceId: env.SARUFI_WORKSPACE_ID,
        ...payload,
      }),
    }).catch(() => null);

    return { success: true };
  }
}

export const sarufiProvider = new SarufiProvider();

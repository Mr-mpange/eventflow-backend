import { briqSmsService } from './BriqSmsService';

describe('BriqSmsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a normal SMS using the configured Briq endpoint', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        success: true,
        data: {
          messageId: 'sms-123',
          status: 'queued',
        },
      })),
    }) as unknown as typeof fetch;

    const result = await briqSmsService.sendMessage({
      to: '+255712345678',
      message: 'Normal SMS from EventFlow',
    });

    expect(result).toEqual({
      externalId: 'sms-123',
      status: 'queued',
      providerStatus: 'queued',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://briq.example.test/v1/message/send-instant',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-API-Key': 'test-briq-key',
        }),
        body: JSON.stringify({
          content: 'Normal SMS from EventFlow',
          recipients: ['+255712345678'],
          sender_id: 'BRIQ',
        }),
      }),
    );
  });

  it('throws an upstream error when Briq rejects the request', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        message: 'Invalid sender',
      })),
    }) as unknown as typeof fetch;

    await expect(
      briqSmsService.sendMessage({
        to: '+255712345678',
        message: 'Normal SMS from EventFlow',
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      code: 'PROVIDER_ERROR',
      message: 'Briq SMS request failed',
    });
  });
});

import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EventFlow API',
      version: '1.0.0',
      description: `
## EventFlow — Event Invitation & WhatsApp Messaging API

### Authentication
- **Internal routes** (events, guests, etc.): Use \`Authorization: Bearer <JWT>\`
- **External WhatsApp API**: Use \`X-API-Key: ef_live_xxxx\` — get your key from the EventFlow admin

### Getting an API Key
1. Log in to EventFlow
2. Call \`POST /api-keys\` with your JWT to generate a key
3. Share the key with developers — they use it in the \`X-API-Key\` header

### Quick Start (External API)
\`\`\`bash
curl -X POST https://api.eventflow.app/api/v1/external/whatsapp/send/template \\
  -H "X-API-Key: ef_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+255712345678",
    "template": "eventflow_invite_en",
    "params": {
      "guestName": "Ali Hassan",
      "eventName": "Wedding Ceremony",
      "eventDate": "July 5, 2026",
      "location": "Serena Hotel, Dar es Salaam",
      "rsvpLink": "https://yourapp.com/rsvp/abc123",
      "qrLink": "https://yourapp.com/qr/abc123"
    }
  }'
\`\`\`
      `,
      contact: { name: 'EventFlow Support', email: 'support@eventflow.app' },
    },
    servers: [
      { url: `${env.APP_URL}/api/${env.API_VERSION}`, description: 'Current Server' },
      { url: 'https://api.eventflow.app/api/v1', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for internal EventFlow users (organizers, admins)',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for external developers. Format: `ef_live_xxxxxxxxxxxx`. Get one from POST /api-keys.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EVENT_ORGANIZER', 'STAFF'] },
          },
        },
        Event: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            eventDate: { type: 'string', format: 'date-time' },
            venue: { type: 'string' },
            status: { type: 'string' },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Acme Corp Integration' },
            keyPrefix: { type: 'string', example: 'ef_live_a1b2' },
            permissions: {
              type: 'array',
              items: { type: 'string', enum: ['send_message', 'get_contacts', 'get_logs', 'get_status'] },
            },
            rateLimit: { type: 'integer', example: 100 },
            isActive: { type: 'boolean' },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        SendTemplateRequest: {
          type: 'object',
          required: ['to', 'template', 'params'],
          properties: {
            to: { type: 'string', example: '+255712345678', description: 'Recipient phone in E.164 format' },
            template: {
              type: 'string',
              enum: ['eventflow_invite_en', 'eventflow_invite_sw'],
              description: 'Template to use — en for English, sw for Swahili',
            },
            params: {
              type: 'object',
              required: ['guestName', 'eventName', 'eventDate', 'location', 'rsvpLink', 'qrLink'],
              properties: {
                guestName: { type: 'string', example: 'Ali Hassan' },
                eventName: { type: 'string', example: 'Wedding Ceremony' },
                eventDate: { type: 'string', example: 'July 5, 2026' },
                location: { type: 'string', example: 'Serena Hotel, Dar es Salaam' },
                rsvpLink: { type: 'string', format: 'uri', example: 'https://yourapp.com/rsvp/abc123' },
                qrLink: { type: 'string', format: 'uri', example: 'https://yourapp.com/qr/abc123' },
              },
            },
          },
        },
        MessageStatus: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            phone: { type: 'string' },
            status: { type: 'string', enum: ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'] },
            externalId: { type: 'string', nullable: true },
            errorMessage: { type: 'string', nullable: true },
            sentAt: { type: 'string', format: 'date-time', nullable: true },
            deliveredAt: { type: 'string', format: 'date-time', nullable: true },
            readAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Events', description: 'Event management' },
      { name: 'Invitations', description: 'Invitation design' },
      { name: 'Guests', description: 'Guest list management' },
      { name: 'RSVP', description: 'RSVP responses' },
      { name: 'QR', description: 'QR code & check-in' },
      { name: 'WhatsApp', description: 'WhatsApp messaging (internal)' },
      { name: 'Analytics', description: 'Event analytics' },
      { name: 'Subscriptions', description: 'Billing & plans' },
      { name: 'API Keys', description: 'Manage external developer API keys (requires JWT login)' },
      { name: 'External WhatsApp API', description: '🔑 External API — authenticate with X-API-Key header. Send WhatsApp messages, track delivery, manage contacts.' },
    ],
  },
  apis: ['./src/modules/**/routes/*.ts', './src/modules/apikey/apikey.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

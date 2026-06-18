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

---

### Authentication
| Route group | How to authenticate |
|---|---|
| Internal routes (events, guests, RSVP, etc.) | \`Authorization: Bearer <JWT>\` — obtain from \`POST /auth/login\` |
| External WhatsApp API | \`X-API-Key: ef_live_xxxx\` — generate from \`POST /api-keys\` |

---

### Getting an API Key (for external developers)
1. Log in to EventFlow — \`POST /auth/login\`
2. Call \`POST /api-keys\` with your JWT to generate a key
3. The **raw key is shown only once** — save it immediately
4. Pass it as \`X-API-Key: ef_live_xxxxx\` on every external API request

---

### Quick Start — Send a WhatsApp Invitation
\`\`\`bash
curl -X POST https://api.eventflow.app/api/v1/external/whatsapp/send/template \\
  -H "X-API-Key: ef_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+255712345678",
    "template": "eventflow_invite_sw",
    "params": {
      "guestName": "Ali Hassan",
      "eventName": "Harusi ya Amina na Juma",
      "eventDate": "5 Julai 2026",
      "location": "Serena Hotel, Dar es Salaam",
      "rsvpLink": "https://yourapp.com/rsvp/guest-uuid-here",
      "qrLink": "https://yourapp.com/qr/guest-uuid-here",
      "imageUrl": "https://res.cloudinary.com/yourcloud/image/upload/event-poster.jpg"
    }
  }'
\`\`\`

---

### ⚠️ Message shows "sent" or "queued" but customer never receives it?

This is the most common issue. Here is a checklist:

**1. Phone number format**
Must be E.164 with country code — no exceptions.
- ✅ \`+255712345678\`
- ❌ \`0712345678\` — missing country code
- ❌ \`255712345678\` — missing leading \`+\`

**2. Number must be on WhatsApp**
This API sends **WhatsApp messages, not SMS**. If the recipient's number is not registered on WhatsApp, the message is silently rejected by Meta. There is no way to detect this before sending.

**3. Use the correct template name**
Only use templates that are **approved** by Meta. Currently approved:
- ✅ \`eventflow_invite_sw\` — Swahili, approved
- ⚠️ \`eventflow_invite_en\` — English, verify approval status before using

**4. Free-text messages — 24-hour session window**
\`POST /send/text\` and \`POST /whatsapp/bulk\` only work if the recipient has messaged your
WhatsApp business number in the last 24 hours. For first-contact messages (invitations),
always use the template endpoint.

**5. rsvpLink and qrLink must be real URLs**
Pass the actual guest token/UUID your frontend uses.
Placeholders like \`"test-123"\` make the buttons point to pages that don't exist.

**6. imageUrl must be publicly accessible**
WhatsApp servers fetch the image directly. URLs behind authentication,
localhost addresses, or expired CDN links will cause the message to fail.

**7. Status stays QUEUED forever**
The BullMQ worker processes messages from the Redis queue.
If the server was restarted without the worker running, messages sit in the queue and are never sent.
Restart the server — the worker starts automatically with \`npm run dev\` or \`npm start\`.

---

### Message status lifecycle
\`\`\`
QUEUED  →  SENT  →  DELIVERED  →  READ
                        ↓
                      FAILED
\`\`\`
Use \`GET /external/whatsapp/status/{messageId}\` to poll delivery status.
Delivery and read receipts are updated via GhalaRails webhook callbacks.
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
            to: {
              type: 'string',
              example: '+255712345678',
              description: 'Recipient phone in E.164 format — must include country code. Tanzania: +255, Kenya: +254, Uganda: +256',
            },
            template: {
              type: 'string',
              enum: ['eventflow_invite_sw', 'eventflow_invite_en'],
              description: 'Template name. Use `eventflow_invite_sw` (Swahili, approved ✅). Check approval status of `eventflow_invite_en` before using.',
              example: 'eventflow_invite_sw',
            },
            params: {
              type: 'object',
              required: ['guestName', 'eventName', 'eventDate', 'location'],
              properties: {
                guestName: { type: 'string', example: 'Ali Hassan', description: 'Guest full name — personalises the greeting' },
                eventName: { type: 'string', example: 'Harusi ya Amina na Juma', description: 'Name of the event' },
                eventDate: { type: 'string', example: '5 Julai 2026', description: 'Human-readable date string' },
                location: { type: 'string', example: 'Serena Hotel, Dar es Salaam', description: 'Venue name and city' },
                rsvpLink: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://yourapp.com/rsvp/guest-uuid-here',
                  description: 'Full URL to your RSVP page. The URL suffix (after the last /) is appended to the template button base URL. Must be a real page — not a placeholder.',
                },
                qrLink: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://yourapp.com/qr/guest-uuid-here',
                  description: 'Full URL to the guest QR code page. Same requirement as rsvpLink.',
                },
                imageUrl: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://res.cloudinary.com/yourcloud/image/upload/event-poster.jpg',
                  description: 'Publicly accessible image URL for the template header. Must be reachable by WhatsApp servers — no localhost, no auth-protected URLs. Recommended: Cloudinary or S3 public URL.',
                },
              },
            },
          },
        },
        MessageStatus: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            phone: { type: 'string', example: '+255712345678' },
            status: {
              type: 'string',
              enum: ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
              description: 'QUEUED=accepted not yet sent | SENT=at WhatsApp | DELIVERED=on device | READ=opened | FAILED=check errorMessage',
            },
            externalId: { type: 'string', nullable: true, description: 'GhalaRails message ID — use this with /status/{messageId}' },
            errorMessage: { type: 'string', nullable: true, description: 'Populated when status=FAILED — contains the reason from WhatsApp/GhalaRails' },
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

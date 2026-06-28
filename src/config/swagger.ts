import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const PROD_URL = 'https://eventflow-backend-614505894752.us-central1.run.app';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EventFlow API',
      version: '1.0.0',
      description: `
## EventFlow — Event Invitation, WhatsApp, and SMS API

**Production base URL:** \`${PROD_URL}/api/v1\`
**API Docs:** \`${PROD_URL}/api-docs\`

---

### Authentication
| Route group | How to authenticate |
|---|---|
| Internal routes (events, guests, RSVP, etc.) | \`Authorization: Bearer <JWT>\` — obtain from \`POST /auth/login\` |
| External WhatsApp API | \`X-API-Key: ef_live_xxxx\` — generate from \`POST /api-keys\` |
| External SMS API | \`X-API-Key: ef_live_xxxx\` — generate from \`POST /api-keys\` |

---

### Getting an API Key (for external developers)
1. Log in to EventFlow — \`POST /auth/login\`
2. Call \`POST /api-keys\` with your JWT to generate a key
3. The **raw key is shown only once** — save it immediately
4. Pass it as \`X-API-Key: ef_live_xxxxx\` on every external API request

---

### Quick Start — Send a WhatsApp Invitation
\`\`\`bash
curl -X POST ${PROD_URL}/api/v1/external/whatsapp/send/template \\
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
      "rsvpLink": "${PROD_URL}/go/rsvp/guest-uuid-here",
      "qrLink": "${PROD_URL}/go/qr/guest-uuid-here",
      "imageUrl": "https://res.cloudinary.com/yourcloud/image/upload/event-poster.jpg"
    }
  }'
\`\`\`

### Quick Start — Send a Normal SMS
\`\`\`bash
curl -X POST ${PROD_URL}/api/v1/external/sms/send \\
  -H "X-API-Key: ef_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+255712345678",
    "message": "Your invitation has been confirmed. See you at 4 PM."
  }'
\`\`\`

---

### WhatsApp Template Button URLs
Register your WhatsApp templates in Meta Business Manager with these **stable base URLs**.
The \`/go/\` routes redirect guests to your frontend — change \`FRONTEND_URL\` in env any time
without re-registering or waiting for template re-approval.

| Button | Base URL to register in Meta |
|---|---|
| RSVP | \`${PROD_URL}/go/rsvp/\` |
| QR Code | \`${PROD_URL}/go/qr/\` |
| Accept Invitation | \`${PROD_URL}/go/accept/\` |

Flow: guest taps button → \`${PROD_URL}/go/rsvp/{uuid}\` → 302 → \`{FRONTEND_URL}/rsvp/{uuid}\`

---

### Per-Guest Custom Images
Each guest can receive their own personalised invitation image:

**Single guest:**
\`\`\`json
POST /api/v1/whatsapp/invite/{guestId}
{ "language": "sw", "imageUrl": "https://res.cloudinary.com/.../ali-card.jpg" }
\`\`\`

**Bulk with per-guest images:**
\`\`\`json
POST /api/v1/whatsapp/bulk-invite
{
  "eventId": "event-uuid",
  "language": "sw",
  "imageUrls": {
    "guest-uuid-1": "https://res.cloudinary.com/.../ali-card.jpg",
    "guest-uuid-2": "https://res.cloudinary.com/.../amina-card.jpg"
  }
}
\`\`\`

Image resolution order per guest: \`imageUrls[guestId]\` → \`imageUrl\` → \`event.coverImageUrl\`

---

### ⚠️ Message shows "sent" or "queued" but customer never receives it?

**1. Phone number format** — Must be E.164 with country code:
- ✅ \`+255712345678\`
- ❌ \`0712345678\` — missing country code

**2. Number must be on WhatsApp** — This API sends WhatsApp messages, not SMS.
If the number is not on WhatsApp the message is silently rejected by Meta.

**3. Use the correct template name** — Only approved templates work:
- ✅ \`eventflow_invite_sw\` — Swahili, approved
- ⚠️ \`eventflow_invite_en\` — English, verify approval status first

**4. Free-text 24-hour window** — \`POST /whatsapp/bulk\` only works if the recipient
messaged your business number in the last 24 hours. Use \`/whatsapp/bulk-invite\` for invitations.

**5. imageUrl must be publicly accessible** — WhatsApp servers fetch it directly.
No auth, no localhost, no expired CDN links. Use Cloudinary/S3 public URLs.

**6. Status stays QUEUED forever** — The BullMQ worker must be running.
The worker service is deployed separately at \`eventflow-worker\` on Cloud Run.

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
      contact: { name: 'EventFlow Support', email: 'support@eventflow.co' },
    },
    servers: [
      {
        url: `${PROD_URL}/api/v1`,
        description: 'Production — Google Cloud Run (us-central1)',
      },
      {
        url: `${env.APP_URL}/api/${env.API_VERSION}`,
        description: 'Current server (from APP_URL env var)',
      },
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
            name: { type: 'string', example: 'My Frontend Integration' },
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
              enum: ['eventflow_invite_sw', 'eventflow_invite_en', 'event_invitation'],
              description: 'Template name. Use `eventflow_invite_sw` (Swahili, approved ✅). `event_invitation` is an alias. Check approval of `eventflow_invite_en` before using.',
              example: 'eventflow_invite_sw',
            },
            params: {
              type: 'object',
              required: ['guestName', 'eventName', 'eventDate', 'location', 'imageUrl'],
              properties: {
                guestName: { type: 'string', example: 'Ali Hassan' },
                eventName: { type: 'string', example: 'Harusi ya Amina na Juma' },
                eventDate: { type: 'string', example: '5 Julai 2026' },
                location: { type: 'string', example: 'Serena Hotel, Dar es Salaam' },
                rsvpLink: {
                  type: 'string',
                  format: 'uri',
                  example: `${PROD_URL}/go/rsvp/guest-uuid-here`,
                  description: 'Use the /go/rsvp/ redirect URL — the backend will forward the guest to your frontend.',
                },
                qrLink: {
                  type: 'string',
                  format: 'uri',
                  example: `${PROD_URL}/go/qr/guest-uuid-here`,
                  description: 'Use the /go/qr/ redirect URL — the backend will forward the guest to your frontend.',
                },
                imageUrl: {
                  type: 'string',
                  format: 'uri',
                  example: 'https://res.cloudinary.com/yourcloud/image/upload/event-poster.jpg',
                  description: 'Required. Publicly accessible image for the WhatsApp template header. Must be reachable by WhatsApp servers without auth.',
                },
              },
            },
          },
        },
        BulkInviteRequest: {
          type: 'object',
          required: ['eventId'],
          properties: {
            eventId: { type: 'string', format: 'uuid' },
            language: { type: 'string', enum: ['en', 'sw'], default: 'sw' },
            guestIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              description: 'Optional — omit to send to all guests with phones',
            },
            groupId: { type: 'string', format: 'uuid', description: 'Optional — send to a specific group' },
            imageUrl: {
              type: 'string',
              format: 'uri',
              description: 'Single image for all guests (fallback when imageUrls not provided)',
            },
            imageUrls: {
              type: 'object',
              additionalProperties: { type: 'string', format: 'uri' },
              description: 'Per-guest images — map of { guestId: imageUrl }. Takes priority over imageUrl.',
              example: {
                'guest-uuid-1': 'https://res.cloudinary.com/.../ali-card.jpg',
                'guest-uuid-2': 'https://res.cloudinary.com/.../amina-card.jpg',
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
              description: 'QUEUED=accepted | SENT=at WhatsApp | DELIVERED=on device | READ=opened | FAILED=see errorMessage',
            },
            externalId: { type: 'string', nullable: true, description: 'GhalaRails message ID' },
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
      { name: 'Invitations', description: 'Invitation design & templates' },
      { name: 'Guests', description: 'Guest list management' },
      { name: 'RSVP', description: 'RSVP responses (public — no auth required)' },
      { name: 'QR', description: 'QR code generation & check-in' },
      { name: 'Redirects', description: '🔗 Stable redirect URLs for WhatsApp template buttons — register these in Meta Business Manager' },
      { name: 'WhatsApp', description: 'WhatsApp messaging — single, bulk plain-text, and bulk invitation template' },
      { name: 'Analytics', description: 'Event analytics & RSVP stats' },
      { name: 'Subscriptions', description: 'Billing & subscription plans' },
      { name: 'API Keys', description: 'Manage external developer API keys (requires JWT login)' },
      { name: 'External WhatsApp API', description: '🔑 External API — authenticate with X-API-Key. Send templates, track delivery.' },
    ],
  },
  apis: [
    './src/modules/**/routes/*.ts',
    './src/modules/apikey/apikey.routes.ts',
    './src/modules/redirect/redirect.routes.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

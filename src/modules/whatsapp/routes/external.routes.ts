/**
 * External WhatsApp API — authenticated via X-API-Key
 * Allows third-party systems to send WhatsApp template messages
 * through EventFlow's GhalaRails account.
 *
 * @swagger
 * components:
 *   securitySchemes:
 *     apiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: X-API-Key
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { authenticateApiKey, requirePermission, ApiKeyRequest } from '@/middleware/apiKey';
import { ghalaRailsService } from '@/infrastructure/whatsapp/GhalaRailsService';
import { prisma } from '@/config/database';

const router = Router();

// All routes require a valid API key
router.use(authenticateApiKey);

// ─── Schemas ────────────────────────────────────────────────

const sendTemplateSchema = z.object({
  to: z.string().min(7).max(20), // E.164 e.g. +255712345678
  template: z.enum(['eventflow_invite_en', 'eventflow_invite_sw', 'event_invitation']),
  params: z.object({
    guestName: z.string().min(1).max(100),
    eventName: z.string().min(1).max(200),
    eventDate: z.string().min(1).max(100),
    location: z.string().min(1).max(200),
    rsvpLink: z.string().min(1).max(500).optional(),
    qrLink: z.string().min(1).max(500).optional(),
    imageUrl: z.string().url(), // Public image URL — required for IMAGE header templates
  }),
});

const sendTextSchema = z.object({
  to: z.string().min(7).max(20),
  message: z.string().min(1).max(4096),
});

// ─── Send template message ───────────────────────────────────

/**
 * @swagger
 * /external/whatsapp/send/template:
 *   post:
 *     tags: [External WhatsApp API]
 *     summary: Send a WhatsApp template message
 *     description: |
 *       Send an approved WhatsApp template to any phone number.
 *       Templates work **without** the recipient needing to message you first (outside the 24-hour session window).
 *
 *       ---
 *       ### ⚠️ Why does the API return "queued" but the customer doesn't receive the message?
 *
 *       **"queued" means the request was accepted by our system — it does NOT guarantee delivery.**
 *       Here are the most common reasons a message is queued but never received:
 *
 *       1. **Wrong phone format** — Phone number must be in E.164 format with country code.
 *          - ✅ Correct: `+255712345678`
 *          - ❌ Wrong: `0712345678`, `255712345678`, `712345678`
 *
 *       2. **Number not on WhatsApp** — The recipient's number must be registered on WhatsApp.
 *          These are WhatsApp messages, NOT SMS. If the number is not on WhatsApp, the message will fail silently.
 *
 *       3. **Wrong template name** — Only use approved template names exactly as listed:
 *          - `eventflow_invite_sw` (Swahili, **approved** ✅)
 *          - `eventflow_invite_en` (English — check approval status before using)
 *          Using a wrong or unapproved template name causes silent failure.
 *
 *       4. **rsvpLink / qrLink must be real URLs** — The RSVP and QR buttons use these as URL suffixes.
 *          Passing placeholder values like `"test-123"` makes the buttons point to non-existent pages.
 *          Always pass the full token/path your frontend uses, e.g. `"guest-uuid-here"`.
 *
 *       5. **imageUrl not publicly accessible** — The template has an IMAGE header.
 *          The image URL must be publicly reachable by WhatsApp servers (no localhost, no auth-protected URLs).
 *
 *       ---
 *       ### Available templates
 *       | Template | Language | Status | Has Image | Has Buttons |
 *       |---|---|---|---|---|
 *       | `eventflow_invite_sw` | Swahili | ✅ Approved | ✅ Yes | ✅ RSVP + QR |
 *       | `eventflow_invite_en` | English | ⚠️ Check status | ✅ Yes | ✅ RSVP + QR |
 *
 *       ---
 *       ### How to verify delivery
 *       After sending, use `GET /external/whatsapp/status/{messageId}` to poll the status.
 *       Status transitions: `QUEUED` → `SENT` → `DELIVERED` → `READ`
 *       If status stays `QUEUED` or becomes `FAILED`, check the `errorMessage` field.
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendTemplateRequest'
 *           example:
 *             to: "+255712345678"
 *             template: "eventflow_invite_sw"
 *             params:
 *               guestName: "Ali Hassan"
 *               eventName: "Harusi ya Amina na Juma"
 *               eventDate: "5 Julai 2026"
 *               location: "Serena Hotel, Dar es Salaam"
 *               rsvpLink: "https://yourapp.com/rsvp/guest-uuid-here"
 *               qrLink: "https://yourapp.com/qr/guest-uuid-here"
 *               imageUrl: "https://res.cloudinary.com/yourcloud/image/upload/event-poster.jpg"
 *     responses:
 *       202:
 *         description: |
 *           Message accepted and queued. **This does not mean the customer received it.**
 *           Use `GET /external/whatsapp/status/{messageId}` to check actual delivery.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                       description: Use this ID to check delivery status
 *                       example: "286307"
 *                     status:
 *                       type: string
 *                       enum: [queued, sent, failed]
 *                       description: Initial status — poll /status/{messageId} for updates
 *                     to:
 *                       type: string
 *                       example: "+255712345678"
 *                     template:
 *                       type: string
 *                       example: "eventflow_invite_sw"
 *       400:
 *         description: Validation error — check phone format (must be E.164) and required params
 *       401:
 *         description: Missing or invalid API key — include `X-API-Key` header
 *       403:
 *         description: API key lacks `send_message` permission
 */
router.post(
  '/send/template',
  requirePermission('send_message'),
  validate(sendTemplateSchema),
  async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const { to, params } = req.body as z.infer<typeof sendTemplateSchema>;
      const templateName: string = req.body.template;
      const lang: 'en' | 'sw' = templateName.endsWith('_sw') ? 'sw' : 'en';

      const result = await ghalaRailsService.sendInvitationTemplate({
        to,
        guestName: params.guestName,
        eventName: params.eventName,
        eventDate: params.eventDate,
        location: params.location,
        rsvpLink: params.rsvpLink ?? '',
        qrLink: params.qrLink ?? '',
        language: lang,
        templateName,
        imageUrl: params.imageUrl,
      });

      res.status(202).json({
        success: true,
        data: {
          messageId: result.externalId,
          status: result.status,
          to,
          template: req.body.template,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @swagger
 * /external/whatsapp/send/text:
 *   post:
 *     tags: [External WhatsApp API]
 *     summary: Send a plain text WhatsApp message
 *     description: |
 *       Send a free-text message to a recipient.
 *
 *       ### ⚠️ Important — 24-hour session window
 *       WhatsApp only allows free-text messages if the recipient **messaged your business number
 *       within the last 24 hours**. Outside that window, the message will be silently rejected by WhatsApp.
 *
 *       **For first-contact messages (invitations, reminders), always use the template endpoint instead.**
 *       Templates bypass the 24-hour restriction.
 *
 *       ### ⚠️ Phone format
 *       Must be E.164 format with country code. Example: `+255712345678` (not `0712345678`).
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, message]
 *             properties:
 *               to:
 *                 type: string
 *                 example: "+255712345678"
 *                 description: Phone in E.164 format — must include country code e.g. +255 for Tanzania
 *               message:
 *                 type: string
 *                 example: "Your event starts tomorrow at 10am!"
 *                 maxLength: 4096
 *     responses:
 *       202:
 *         description: |
 *           Message accepted. **Only delivers if the recipient messaged your WhatsApp number in the last 24 hours.**
 *           Use the template endpoint for guaranteed first-contact delivery.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 messageId: "286310"
 *                 status: "queued"
 *                 to: "+255712345678"
 *       400:
 *         description: Validation error — check phone format
 *       401:
 *         description: Missing or invalid API key
 */
router.post(
  '/send/text',
  requirePermission('send_message'),
  validate(sendTextSchema),
  async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const { to, message } = req.body as z.infer<typeof sendTextSchema>;

      const result = await ghalaRailsService.sendMessage({ to, message });

      res.status(202).json({
        success: true,
        data: { messageId: result.externalId, status: result.status, to },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Get message logs ────────────────────────────────────────

/**
 * @swagger
 * /external/whatsapp/logs:
 *   get:
 *     tags: [External WhatsApp API]
 *     summary: Get message history
 *     description: View sent message logs with delivery status.
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         description: Filter by phone number e.g. +255712345678
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Message logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/MessageStatus'
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get(
  '/logs',
  requirePermission('get_logs'),
  async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const phone = req.query.phone as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);

      const where = {
        ...(phone ? { phone: String(phone) } : {}),
      };

      const [messages, total] = await Promise.all([
        prisma.whatsAppMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            phone: true,
            message: true,
            status: true,
            externalId: true,
            errorMessage: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
            createdAt: true,
          },
        }),
        prisma.whatsAppMessage.count({ where }),
      ]);

      res.json({
        success: true,
        data: { messages, total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Get message status ──────────────────────────────────────

/**
 * @swagger
 * /external/whatsapp/status/{messageId}:
 *   get:
 *     tags: [External WhatsApp API]
 *     summary: Check delivery status of a message
 *     description: |
 *       Returns the current delivery status of a message.
 *
 *       ### Status lifecycle
 *       ```
 *       QUEUED → SENT → DELIVERED → READ
 *                           ↓
 *                         FAILED
 *       ```
 *
 *       | Status | Meaning |
 *       |---|---|
 *       | `QUEUED` | Accepted by EventFlow, not yet sent to WhatsApp |
 *       | `SENT` | Sent to WhatsApp — waiting for recipient's device |
 *       | `DELIVERED` | Reached the recipient's phone ✅ |
 *       | `READ` | Recipient opened the message ✅ |
 *       | `FAILED` | Delivery failed — check `errorMessage` for reason |
 *
 *       ### Why does status stay QUEUED?
 *       - The background worker may not be running on the server
 *       - Redis queue may be down
 *       - Contact creation on GhalaRails failed
 *
 *       ### Why does status stay SENT but never DELIVERED?
 *       - The recipient's number may not be on WhatsApp
 *       - The recipient's phone is off or has no internet
 *       - Webhook updates may not be configured (delivery/read receipts come via webhook)
 *
 *       **Note:** The `messageId` here is the `externalId` returned from the send endpoint (GhalaRails message ID).
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The `messageId` (externalId) returned from POST /send/template or /send/text
 *         example: "286307"
 *     responses:
 *       200:
 *         description: Message status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageStatus'
 *             example:
 *               success: true
 *               data:
 *                 id: "uuid"
 *                 phone: "+255712345678"
 *                 status: "DELIVERED"
 *                 externalId: "286307"
 *                 errorMessage: null
 *                 sentAt: "2026-06-18T06:42:08Z"
 *                 deliveredAt: "2026-06-18T06:42:15Z"
 *                 readAt: null
 *                 createdAt: "2026-06-18T06:42:05Z"
 *       404:
 *         description: Message not found — the messageId may be from GhalaRails directly (not tracked in EventFlow DB)
 */
router.get(
  '/status/:messageId',
  requirePermission('get_status'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const message = await prisma.whatsAppMessage.findFirst({
        where: { externalId: String(req.params.messageId) },
        select: {
          id: true,
          phone: true,
          status: true,
          externalId: true,
          errorMessage: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          createdAt: true,
        },
      });

      if (!message) {
        res.status(404).json({ success: false, error: 'Message not found' });
        return;
      }

      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Contacts ────────────────────────────────────────────────

/**
 * @swagger
 * /external/whatsapp/contacts:
 *   post:
 *     tags: [External WhatsApp API]
 *     summary: Create or find a contact
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+255712345678"
 *               name:
 *                 type: string
 *                 example: "Ali Hassan"
 *     responses:
 *       200:
 *         description: Contact created or found
 *   get:
 *     tags: [External WhatsApp API]
 *     summary: Check if a contact exists
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         example: "+255712345678"
 *     responses:
 *       200:
 *         description: Contact lookup result
 */
router.post(
  '/contacts',
  requirePermission('get_contacts'),
  validate(z.object({ phone: z.string().min(7), name: z.string().optional() })),
  async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const { phone, name } = req.body as { phone: string; name?: string };

      // Upsert via GhalaRails
      const contactId = await (ghalaRailsService as any).upsertContact(phone);

      res.json({ success: true, data: { contactId, phone, name } });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/external/whatsapp/contacts?phone=+255712345678
 * Check if a phone number exists as a contact.
 */
router.get(
  '/contacts',
  requirePermission('get_contacts'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        res.status(400).json({ success: false, error: 'phone query param required' });
        return;
      }

      const messages = await prisma.whatsAppMessage.findFirst({
        where: { phone },
        select: { phone: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: { phone, exists: !!messages, lastMessage: messages },
      });
    } catch (error) {
      next(error);
    }
  },
);

// ─── Available templates ─────────────────────────────────────

/**
 * @swagger
 * /external/whatsapp/templates:
 *   get:
 *     tags: [External WhatsApp API]
 *     summary: List available WhatsApp templates
 *     description: Returns all approved templates you can send with their required parameters.
 *     security:
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of available templates
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 templates:
 *                   - name: eventflow_invite_en
 *                     language: en
 *                     description: Event invitation in English with RSVP and QR code buttons
 *                     params: [guestName, eventName, eventDate, location, rsvpLink, qrLink]
 *                   - name: eventflow_invite_sw
 *                     language: sw
 *                     description: Event invitation in Swahili with RSVP and QR code buttons
 *                     params: [guestName, eventName, eventDate, location, rsvpLink, qrLink]
 */
router.get('/templates', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      templates: [
        {
          name: 'eventflow_invite_en',
          language: 'en',
          description: 'Event invitation in English with RSVP and QR code buttons',
          params: ['guestName', 'eventName', 'eventDate', 'location', 'rsvpLink', 'qrLink'],
        },
        {
          name: 'eventflow_invite_sw',
          language: 'sw',
          description: 'Event invitation in Swahili with RSVP and QR code buttons',
          params: ['guestName', 'eventName', 'eventDate', 'location', 'rsvpLink', 'qrLink'],
        },
      ],
    },
  });
});

export default router;

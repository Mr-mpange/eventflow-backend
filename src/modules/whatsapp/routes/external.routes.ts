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
  template: z.enum(['eventflow_invite_en', 'eventflow_invite_sw']),
  params: z.object({
    guestName: z.string().min(1).max(100),
    eventName: z.string().min(1).max(200),
    eventDate: z.string().min(1).max(100),
    location: z.string().min(1).max(200),
    rsvpLink: z.string().url(),
    qrLink: z.string().url(),
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
 *       Templates work **without** the recipient needing to message you first.
 *
 *       Available templates:
 *       - `eventflow_invite_en` — English invitation with RSVP + QR buttons
 *       - `eventflow_invite_sw` — Swahili invitation with RSVP + QR buttons
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
 *             template: "eventflow_invite_en"
 *             params:
 *               guestName: "Ali Hassan"
 *               eventName: "Wedding Ceremony"
 *               eventDate: "July 5, 2026"
 *               location: "Serena Hotel, Dar es Salaam"
 *               rsvpLink: "https://yourapp.com/rsvp/abc123"
 *               qrLink: "https://yourapp.com/qr/abc123"
 *     responses:
 *       202:
 *         description: Message queued successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 messageId: "283850"
 *                 status: "queued"
 *                 to: "+255712345678"
 *                 template: "eventflow_invite_en"
 *       401:
 *         description: Missing or invalid API key
 *       403:
 *         description: API key lacks send_message permission
 */
router.post(
  '/send/template',
  requirePermission('send_message'),
  validate(sendTemplateSchema),
  async (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    try {
      const { to, params } = req.body as z.infer<typeof sendTemplateSchema>;
      const lang: 'en' | 'sw' = req.body.template?.endsWith('_sw') ? 'sw' : 'en';

      const result = await ghalaRailsService.sendInvitationTemplate({
        to,
        guestName: params.guestName,
        eventName: params.eventName,
        eventDate: params.eventDate,
        location: params.location,
        rsvpLink: params.rsvpLink,
        qrLink: params.qrLink,
        language: lang,
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
 *       Send a free-text message. **Note:** Only works if the recipient has messaged
 *       your business number within the last 24 hours (WhatsApp session window).
 *       For first-contact messages, use the template endpoint instead.
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
 *               message:
 *                 type: string
 *                 example: "Your event starts tomorrow at 10am!"
 *     responses:
 *       202:
 *         description: Message queued
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
 *     description: Returns the current delivery status (QUEUED, SENT, DELIVERED, READ, FAILED).
 *     security:
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: The externalId returned when sending a message
 *     responses:
 *       200:
 *         description: Message status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageStatus'
 *       404:
 *         description: Message not found
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

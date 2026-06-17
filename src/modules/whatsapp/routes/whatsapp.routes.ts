import { Router } from 'express';
import { whatsAppController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import {
  sendMessageSchema,
  bulkMessageSchema,
  scheduleCampaignSchema,
  createTemplateSchema,
} from '../validators/whatsapp.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /whatsapp/send:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send a WhatsApp message to a single guest
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [guestId, message]
 *             properties:
 *               guestId:
 *                 type: string
 *                 format: uuid
 *               message:
 *                 type: string
 *                 example: "Your event is tomorrow!"
 *     responses:
 *       202:
 *         description: Message queued
 *
 * /whatsapp/bulk:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send a WhatsApp message to multiple guests
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, message]
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               message:
 *                 type: string
 *               guestIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional — leave empty to send to all guests
 *               groupId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional — send to a specific group
 *     responses:
 *       202:
 *         description: Bulk messages queued
 *
 * /whatsapp/invite/{guestId}:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send event invitation with RSVP and QR code buttons
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [en, sw]
 *                 default: en
 *                 description: en = English, sw = Swahili
 *     responses:
 *       202:
 *         description: Invitation sent
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 messageId: "msg-uuid"
 *                 channel: "whatsapp_template"
 *                 status: "QUEUED"
 *                 rsvpLink: "https://eventflow.app/rsvp/guest-id"
 *                 qrLink: "https://eventflow.app/qr/qr-code"
 *
 * /whatsapp/campaigns/schedule:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Schedule a WhatsApp campaign
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, name, message, scheduledAt]
 *             properties:
 *               eventId:
 *                 type: string
 *               name:
 *                 type: string
 *               message:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               guestIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Campaign scheduled
 *
 * /whatsapp/campaigns/{campaignId}/tracking:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get delivery tracking for a campaign
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery stats and message list
 *
 * /whatsapp/campaigns/event/{eventId}:
 *   get:
 *     tags: [WhatsApp]
 *     summary: List all campaigns for an event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Campaign list
 *
 * /whatsapp/templates:
 *   get:
 *     tags: [WhatsApp]
 *     summary: List saved WhatsApp templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template list
 *   post:
 *     tags: [WhatsApp]
 *     summary: Save a new WhatsApp template
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, content]
 *             properties:
 *               name:
 *                 type: string
 *               language:
 *                 type: string
 *                 default: en
 *               category:
 *                 type: string
 *               content:
 *                 type: object
 *     responses:
 *       201:
 *         description: Template saved
 */
router.post('/send', validate(sendMessageSchema), whatsAppController.sendSingle);
router.post('/bulk', validate(bulkMessageSchema), whatsAppController.sendBulk);
router.post('/campaigns/schedule', validate(scheduleCampaignSchema), whatsAppController.scheduleCampaign);
router.get('/campaigns/:campaignId/tracking', whatsAppController.getDeliveryTracking);
router.get('/campaigns/event/:eventId', whatsAppController.listCampaigns);
router.get('/templates', whatsAppController.getTemplates);
router.post('/templates', validate(createTemplateSchema), whatsAppController.createTemplate);
router.post('/invite/:guestId', whatsAppController.sendInvitation);

export default router;

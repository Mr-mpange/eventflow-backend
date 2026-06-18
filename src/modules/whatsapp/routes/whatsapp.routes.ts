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
 *     summary: Send a plain text WhatsApp message to a single guest
 *     description: |
 *       Sends a free-text WhatsApp message to one guest by their internal guest ID.
 *
 *       ### ⚠️ Why the message may not arrive
 *       - **24-hour session window**: WhatsApp only delivers free-text messages if the recipient
 *         messaged your business number within the last 24 hours. Outside that window, the message
 *         is silently rejected. Use `POST /whatsapp/invite/{guestId}` for first-contact messages.
 *       - **Guest has no phone number**: The guest record must have a `phone` field set. If it's
 *         null the request will return a validation error.
 *       - **Message stays QUEUED**: The BullMQ worker must be running on the server. If the server
 *         was started without the worker, messages sit in the Redis queue forever.
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
 *                 description: Internal EventFlow guest ID (from the guests table)
 *               message:
 *                 type: string
 *                 example: "Your event is tomorrow at 10am — we look forward to seeing you!"
 *                 maxLength: 4096
 *     responses:
 *       202:
 *         description: Message accepted and added to the send queue
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "msg-uuid"
 *                 status: "QUEUED"
 *                 phone: "+255712345678"
 *       400:
 *         description: Guest has no phone number, or guestId is invalid
 *       404:
 *         description: Guest not found
 *
 * /whatsapp/bulk:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send a plain text WhatsApp message to multiple guests
 *     description: |
 *       Queues a plain text message to all guests of an event (or a filtered subset).
 *
 *       ### ⚠️ Requirements — bulk send will silently send 0 messages if these are not met
 *
 *       1. **Guests must have phone numbers** — Only guests where `phone` is not null are included.
 *          If none of your guests have phone numbers saved, this returns `"No guests with phone numbers found"`.
 *
 *       2. **The BullMQ worker must be running** — Messages are queued in Redis and processed
 *          by the WhatsApp worker. If the server started without the worker, messages stay `QUEUED` forever.
 *
 *       3. **24-hour session window** — Free-text bulk messages only reach recipients who messaged
 *          your business number in the last 24 hours. For event invitations, use
 *          `POST /whatsapp/invite/{guestId}` per guest instead — it uses an approved template
 *          that bypasses this restriction.
 *
 *       ### Targeting options
 *       - No `guestIds` or `groupId` → sends to **all guests** with a phone in the event
 *       - `guestIds` array → sends only to those specific guests
 *       - `groupId` → sends to all guests in that group who have a phone
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
 *                 description: The event whose guests will receive the message
 *               message:
 *                 type: string
 *                 example: "Reminder — the event is tomorrow! See you there."
 *                 maxLength: 4096
 *               guestIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Optional — target specific guests. Leave empty to send to all.
 *               groupId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional — target a specific guest group
 *     responses:
 *       202:
 *         description: Messages queued for all eligible guests
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 campaignId: "campaign-uuid"
 *                 queued: 42
 *       400:
 *         description: No guests with phone numbers found, or validation error
 *       404:
 *         description: Event not found
 *
 * /whatsapp/invite/{guestId}:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send event invitation (template with image + RSVP + QR buttons)
 *     description: |
 *       Sends the approved WhatsApp invitation template to a single guest.
 *       This is the **recommended way to send invitations** — it uses a pre-approved
 *       template that works even for first-contact messages (bypasses the 24-hour window).
 *
 *       ### What the guest receives
 *       - An image header (event poster if `coverImageUrl` is set on the event)
 *       - Personalised body: their name, event name, date, and location
 *       - Two buttons: **Thibitisha Kuja** (RSVP) and **Ona QR Code**
 *
 *       ### ⚠️ Why the buttons don't work
 *       The RSVP and QR buttons link to your frontend app using the guest's IDs:
 *       - RSVP button → `{FRONTEND_URL}/rsvp/{guest.id}`
 *       - QR button → `{FRONTEND_URL}/qr/{guest.qrCode}`
 *
 *       For buttons to work:
 *       1. `FRONTEND_URL` in `.env` must point to your deployed frontend (not `localhost`)
 *       2. Your frontend must have routes `/rsvp/:guestId` and `/qr/:qrCode`
 *       3. The guest must have a `qrCode` generated — call `POST /qr/generate/{guestId}` first
 *
 *       ### ⚠️ Why the message may not arrive
 *       - Guest has no `phone` number set
 *       - Phone is not registered on WhatsApp
 *       - Template `eventflow_invite_en` may not be approved — use `language: "sw"` for the approved Swahili template
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: guestId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Internal EventFlow guest ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [en, sw]
 *                 default: sw
 *                 description: |
 *                   `sw` = Swahili (approved ✅ — use this)
 *                   `en` = English (check approval status before using)
 *           example:
 *             language: "sw"
 *     responses:
 *       202:
 *         description: Invitation sent via approved template
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 messageId: "msg-uuid"
 *                 channel: "whatsapp_template"
 *                 status: "QUEUED"
 *                 rsvpLink: "https://yourfrontend.com/rsvp/guest-uuid"
 *                 qrLink: "https://yourfrontend.com/qr/qr-code-uuid"
 *       400:
 *         description: Guest has no phone number
 *       404:
 *         description: Guest not found
 *
 * /whatsapp/campaigns/schedule:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Schedule a WhatsApp campaign for a future time
 *     description: |
 *       Schedules a bulk plain-text message to be sent at a specific time.
 *       Same requirements as bulk send — guests must have phone numbers and the worker must be running.
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
 *                 format: uuid
 *               name:
 *                 type: string
 *                 example: "Day-before reminder"
 *               message:
 *                 type: string
 *                 example: "The event is tomorrow! Doors open at 9am."
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-07-04T18:00:00.000Z"
 *               guestIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Optional — leave empty to send to all guests with phones
 *               templateId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional — link to a saved template record
 *     responses:
 *       201:
 *         description: Campaign scheduled
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "campaign-uuid"
 *                 name: "Day-before reminder"
 *                 status: "scheduled"
 *                 scheduledAt: "2026-07-04T18:00:00.000Z"
 *
 * /whatsapp/campaigns/{campaignId}/tracking:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get delivery tracking stats for a campaign
 *     description: Returns per-message delivery status and aggregate stats (queued/sent/delivered/failed).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: campaignId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign stats and message list
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 campaign:
 *                   id: "campaign-uuid"
 *                   name: "Day-before reminder"
 *                   status: "sent"
 *                 stats:
 *                   total: 50
 *                   queued: 2
 *                   sent: 10
 *                   delivered: 36
 *                   failed: 2
 *                 messages: []
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
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign list
 *
 * /whatsapp/templates:
 *   get:
 *     tags: [WhatsApp]
 *     summary: List locally saved WhatsApp template records
 *     description: Returns templates saved in the EventFlow database. For live GhalaRails templates, use the External API.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template list
 *   post:
 *     tags: [WhatsApp]
 *     summary: Save a WhatsApp template record
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

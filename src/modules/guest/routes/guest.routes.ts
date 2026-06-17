import { Router } from 'express';
import { z } from 'zod';
import { guestController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createGuestSchema, updateGuestSchema, listGuestsSchema, createGroupSchema } from '../validators/guest.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /guests:
 *   post:
 *     tags: [Guests]
 *     summary: Add a guest to an event
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, fullName]
 *             properties:
 *               eventId:
 *                 type: string
 *                 format: uuid
 *               fullName:
 *                 type: string
 *                 example: "Ali Hassan"
 *               phone:
 *                 type: string
 *                 example: "+255712345678"
 *               email:
 *                 type: string
 *               groupId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Guest added
 *
 * /guests/event/{eventId}:
 *   get:
 *     tags: [Guests]
 *     summary: List guests for an event
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: rsvpStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, ACCEPTED, DECLINED, MAYBE]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Paginated guest list
 *
 * /guests/{id}:
 *   patch:
 *     tags: [Guests]
 *     summary: Update a guest
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Guest updated
 *   delete:
 *     tags: [Guests]
 *     summary: Remove a guest
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Guest removed
 *
 * /guests/event/{eventId}/import:
 *   post:
 *     tags: [Guests]
 *     summary: Bulk import guests
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guests:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     fullName:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     email:
 *                       type: string
 *     responses:
 *       200:
 *         description: Guests imported
 *
 * /guests/event/{eventId}/export:
 *   get:
 *     tags: [Guests]
 *     summary: Export guest list as CSV
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
 *         description: CSV file download
 *
 * /guests/groups:
 *   post:
 *     tags: [Guests]
 *     summary: Create a guest group
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventId, name]
 *             properties:
 *               eventId:
 *                 type: string
 *               name:
 *                 type: string
 *                 example: "Family"
 *               color:
 *                 type: string
 *                 example: "#FF5733"
 *     responses:
 *       201:
 *         description: Group created
 *
 * /guests/event/{eventId}/groups:
 *   get:
 *     tags: [Guests]
 *     summary: List guest groups for an event
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
 *         description: List of groups
 */
router.post('/', validate(createGuestSchema), guestController.create);
router.get('/event/:eventId', validate(listGuestsSchema, 'query'), guestController.list);
router.patch('/:id', validate(updateGuestSchema), guestController.update);
router.delete('/:id', guestController.delete);
router.post('/event/:eventId/import', validate(z.object({
  guests: z.array(z.object({
    fullName: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    group: z.string().optional(),
  })),
})), guestController.importCsv);
router.get('/event/:eventId/export', guestController.exportCsv);
router.post('/groups', validate(createGroupSchema), guestController.createGroup);
router.get('/event/:eventId/groups', guestController.listGroups);

export default router;

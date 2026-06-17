import { Router } from 'express';
import { eventController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createEventSchema, updateEventSchema, listEventsSchema } from '../validators/event.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /events/categories:
 *   get:
 *     tags: [Events]
 *     summary: List all event categories
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/categories', eventController.getCategories);

/**
 * @swagger
 * /events:
 *   get:
 *     tags: [Events]
 *     summary: List your events
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PUBLISHED, ACTIVE, COMPLETED, CANCELLED]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of events
 *   post:
 *     tags: [Events]
 *     summary: Create a new event
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, eventDate]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Tech Summit 2026"
 *               description:
 *                 type: string
 *               eventDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-07-05T10:00:00Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               venue:
 *                 type: string
 *                 example: "Serena Hotel, Dar es Salaam"
 *               categoryId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Event created
 *
 * /events/{id}:
 *   get:
 *     tags: [Events]
 *     summary: Get event by ID
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
 *         description: Event details
 *   patch:
 *     tags: [Events]
 *     summary: Update an event
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
 *               title:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ACTIVE, COMPLETED, CANCELLED]
 *               venue:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated
 *   delete:
 *     tags: [Events]
 *     summary: Delete an event
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
 *         description: Event deleted
 */
router.get('/', validate(listEventsSchema, 'query'), eventController.list);
router.post('/', validate(createEventSchema), eventController.create);
router.get('/:id', eventController.getById);
router.patch('/:id', validate(updateEventSchema), eventController.update);
router.delete('/:id', eventController.delete);
router.post('/:id/cover', ...eventController.uploadCover);
router.get('/:id/settings', eventController.getSettings);
router.patch('/:id/settings', eventController.updateSettings);

export default router;

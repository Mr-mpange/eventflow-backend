import { Router } from 'express';
import { eventController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createEventSchema, updateEventSchema, listEventsSchema } from '../validators/event.validator';

const router = Router();

router.use(authenticate);

router.get('/categories', eventController.getCategories);
router.get('/', validate(listEventsSchema, 'query'), eventController.list);
router.post('/', validate(createEventSchema), eventController.create);
router.get('/:id', eventController.getById);
router.patch('/:id', validate(updateEventSchema), eventController.update);
router.delete('/:id', eventController.delete);
router.post('/:id/cover', ...eventController.uploadCover);
router.get('/:id/settings', eventController.getSettings);
router.patch('/:id/settings', eventController.updateSettings);

export default router;

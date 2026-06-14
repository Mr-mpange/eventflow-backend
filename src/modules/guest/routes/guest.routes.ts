import { Router } from 'express';
import { z } from 'zod';
import { guestController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createGuestSchema, updateGuestSchema, listGuestsSchema, createGroupSchema } from '../validators/guest.validator';

const router = Router();

router.use(authenticate);

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

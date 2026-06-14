import { Router } from 'express';
import { invitationController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createInvitationSchema, updateInvitationSchema } from '../validators/invitation.validator';

const router = Router();

router.use(authenticate);

router.get('/templates', invitationController.getTemplates);
router.post('/', validate(createInvitationSchema), invitationController.create);
router.get('/event/:eventId', invitationController.listByEvent);
router.get('/:id', invitationController.getById);
router.patch('/:id', validate(updateInvitationSchema), invitationController.update);
router.get('/:id/preview', invitationController.preview);
router.post('/:id/publish', invitationController.publish);
router.delete('/:id', invitationController.delete);

export default router;

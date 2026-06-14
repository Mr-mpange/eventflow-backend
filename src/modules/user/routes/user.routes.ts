import { Router } from 'express';
import { z } from 'zod';
import { userController } from '@/shared/container';
import { authenticate } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import {
  updateProfileSchema,
  changePasswordSchema,
  updateOrganizationSchema,
} from '../validators/user.validator';

const router = Router();

router.use(authenticate);

router.patch('/profile', validate(updateProfileSchema), userController.updateProfile);
router.post('/avatar', ...userController.uploadAvatar);
router.post('/change-password', validate(changePasswordSchema), userController.changePassword);
router.get('/organization', userController.getOrganization);
router.post('/organization', validate(z.object({ name: z.string().min(1) })), userController.createOrganization);
router.patch('/organization', validate(updateOrganizationSchema), userController.updateOrganization);

export default router;

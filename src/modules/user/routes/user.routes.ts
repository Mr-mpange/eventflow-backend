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

/**
 * @swagger
 * /users/profile:
 *   patch:
 *     tags: [Users]
 *     summary: Update your profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.patch('/profile', validate(updateProfileSchema), userController.updateProfile);
router.post('/avatar', ...userController.uploadAvatar);

/**
 * @swagger
 * /users/change-password:
 *   post:
 *     tags: [Users]
 *     summary: Change your password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 example: "NewPass@1234"
 *     responses:
 *       200:
 *         description: Password changed
 */
router.post('/change-password', validate(changePasswordSchema), userController.changePassword);

/**
 * @swagger
 * /users/organization:
 *   get:
 *     tags: [Users]
 *     summary: Get your organization
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organization details
 *   post:
 *     tags: [Users]
 *     summary: Create an organization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Mpange Tech Solutions"
 *     responses:
 *       201:
 *         description: Organization created
 *   patch:
 *     tags: [Users]
 *     summary: Update your organization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               website:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Organization updated
 */
router.get('/organization', userController.getOrganization);
router.post('/organization', validate(z.object({ name: z.string().min(1) })), userController.createOrganization);
router.patch('/organization', validate(updateOrganizationSchema), userController.updateOrganization);

export default router;

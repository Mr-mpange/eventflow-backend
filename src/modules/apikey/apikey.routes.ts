/**
 * API Key Management Routes
 * Only accessible by authenticated EventFlow users (you).
 * Use these to create, list, and revoke API keys for external developers.
 *
 * @swagger
 * tags:
 *   - name: API Keys
 *     description: Manage external developer API keys
 *
 * /api-keys:
 *   post:
 *     tags: [API Keys]
 *     summary: Create a new API key
 *     description: |
 *       Creates a new API key for an external developer.
 *       **The raw key is returned only once — save it immediately.**
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
 *                 example: "Acme Corp Integration"
 *                 description: A label to identify who this key belongs to
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [send_message, get_contacts, get_logs, get_status]
 *                 default: [send_message, get_contacts, get_logs, get_status]
 *               rateLimit:
 *                 type: integer
 *                 default: 100
 *                 description: Max requests per minute
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Optional expiry date
 *     responses:
 *       201:
 *         description: API key created — save the key field, it won't be shown again
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "API key created. Save the key now — it will not be shown again."
 *               data:
 *                 id: "uuid"
 *                 name: "Acme Corp Integration"
 *                 key: "ef_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
 *                 keyPrefix: "ef_live_a1b2"
 *                 permissions: [send_message, get_contacts, get_logs, get_status]
 *                 rateLimit: 100
 *   get:
 *     tags: [API Keys]
 *     summary: List all your API keys
 *     description: Returns all keys without the actual key value.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ApiKey'
 *
 * /api-keys/{id}:
 *   patch:
 *     tags: [API Keys]
 *     summary: Update an API key
 *     description: Enable/disable a key or change its permissions.
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
 *               name:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               rateLimit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Key updated
 *   delete:
 *     tags: [API Keys]
 *     summary: Revoke an API key
 *     description: Permanently disables the key. The developer will get 401 on next request.
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
 *         description: Key revoked
 */
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/config/database';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { NotFoundError, ForbiddenError } from '@/shared/errors/AppError';

const router = Router();
router.use(authenticate);

const PERMISSIONS = ['send_message', 'get_contacts', 'get_logs', 'get_status'] as const;

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(PERMISSIONS)).default([...PERMISSIONS]),
  rateLimit: z.number().int().min(1).max(10000).default(100),
  expiresAt: z.string().datetime().optional(),
});

/**
 * POST /api/v1/api-keys
 * Create a new API key. The raw key is returned ONCE — store it securely.
 */
router.post(
  '/',
  validate(createKeySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { name, permissions, rateLimit, expiresAt } = req.body as z.infer<typeof createKeySchema>;

      // Generate a secure random key: ef_live_<32 random hex chars>
      const rawKey = `ef_live_${randomBytes(24).toString('hex')}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.slice(0, 16); // "ef_live_XXXXXXXX"

      const apiKey = await prisma.apiKey.create({
        data: {
          name,
          keyHash,
          keyPrefix,
          ownerId: req.user!.sub,
          permissions,
          rateLimit,
          ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        },
      });

      res.status(201).json({
        success: true,
        message: 'API key created. Save the key now — it will not be shown again.',
        data: {
          id: apiKey.id,
          name: apiKey.name,
          key: rawKey,           // ← shown ONCE
          keyPrefix: apiKey.keyPrefix,
          permissions: apiKey.permissions,
          rateLimit: apiKey.rateLimit,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/api-keys
 * List all your API keys (without the actual key value).
 */
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { ownerId: req.user!.sub, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: keys });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/api-keys/:id
 * Enable/disable a key or update its settings.
 */
router.patch(
  '/:id',
  validate(z.object({
    name: z.string().min(1).max(100).optional(),
    isActive: z.boolean().optional(),
    permissions: z.array(z.enum(PERMISSIONS)).optional(),
    rateLimit: z.number().int().min(1).max(10000).optional(),
  })),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const key = await prisma.apiKey.findFirst({
        where: { id: String(req.params.id), deletedAt: null },
      });
      if (!key) throw new NotFoundError('ApiKey', String(req.params.id));
      if (key.ownerId !== req.user!.sub) throw new ForbiddenError();

      const updated = await prisma.apiKey.update({
        where: { id: String(req.params.id) },
        data: req.body,
        select: {
          id: true, name: true, keyPrefix: true,
          permissions: true, rateLimit: true,
          isActive: true, lastUsedAt: true, expiresAt: true,
        },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * DELETE /api/v1/api-keys/:id
 * Revoke (soft-delete) an API key.
 */
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const key = await prisma.apiKey.findFirst({
      where: { id: String(req.params.id), deletedAt: null },
    });
    if (!key) throw new NotFoundError('ApiKey', String(req.params.id));
    if (key.ownerId !== req.user!.sub) throw new ForbiddenError();

    await prisma.apiKey.update({
      where: { id: String(req.params.id) },
      data: { deletedAt: new Date(), isActive: false },
    });

    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    next(error);
  }
});

export default router;

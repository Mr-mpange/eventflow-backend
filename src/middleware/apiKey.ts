import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { prisma } from '@/config/database';
import { UnauthorizedError, ForbiddenError } from '@/shared/errors/AppError';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    ownerId: string;
    permissions: string[];
    name: string;
  };
}

/**
 * Authenticate requests using X-API-Key header.
 * The key is hashed and compared against stored key hashes.
 */
export async function authenticateApiKey(
  req: ApiKeyRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawKey = req.headers['x-api-key'] as string | undefined;
    if (!rawKey) throw new UnauthorizedError('Missing X-API-Key header');

    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!apiKey) throw new UnauthorizedError('Invalid or expired API key');

    // Update last used timestamp (fire and forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => null);

    req.apiKey = {
      id: apiKey.id,
      ownerId: apiKey.ownerId,
      permissions: apiKey.permissions as string[],
      name: apiKey.name,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check that the authenticated API key has the required permission.
 */
export function requirePermission(permission: string) {
  return (req: ApiKeyRequest, _res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      next(new UnauthorizedError());
      return;
    }
    if (!req.apiKey.permissions.includes(permission)) {
      next(new ForbiddenError(`API key missing permission: ${permission}`));
      return;
    }
    next();
  };
}

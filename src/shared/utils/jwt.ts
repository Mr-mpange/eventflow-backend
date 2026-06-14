import jwt, { SignOptions } from 'jsonwebtoken';
import { jwtConfig } from '@/config';
import { UnauthorizedError } from '@/shared/errors/AppError';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  organizationId?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: jwtConfig.accessExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, jwtConfig.accessSecret, options);
}

export function signRefreshToken(payload: Pick<JwtPayload, 'sub'>): string {
  const options: SignOptions = { expiresIn: jwtConfig.refreshExpiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, jwtConfig.refreshSecret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, jwtConfig.accessSecret) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

export function verifyRefreshToken(token: string): Pick<JwtPayload, 'sub'> {
  try {
    return jwt.verify(token, jwtConfig.refreshSecret) as Pick<JwtPayload, 'sub'>;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }
}

export function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

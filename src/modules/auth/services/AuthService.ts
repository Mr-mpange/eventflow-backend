import { Role } from '@prisma/client';
import { UserRepository } from '../repositories/UserRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { PasswordResetRepository } from '../repositories/PasswordResetRepository';
import { EmailVerificationRepository } from '../repositories/EmailVerificationRepository';
import { hashPassword, verifyPassword } from '@/shared/utils/password';
import { signAccessToken, signRefreshToken, parseExpiresIn } from '@/shared/utils/jwt';
import { generateToken } from '@/shared/utils/helpers';
import { jwtConfig } from '@/config';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '@/shared/errors/AppError';
import { emailService } from '@/infrastructure/email/EmailService';
import { auditService } from '@/shared/services/AuditService';
import type {
  RegisterDto,
  LoginDto,
  ResetPasswordDto,
} from '../validators/auth.validator';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
  avatarUrl: string | null;
  organizationId: string | null;
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly passwordResetRepo: PasswordResetRepository,
    private readonly emailVerificationRepo: EmailVerificationRepository,
  ) {}

  async register(dto: RegisterDto, meta?: { ip?: string; userAgent?: string }): Promise<{
    user: AuthUser;
    tokens: AuthTokens;
  }> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: Role.EVENT_ORGANIZER,
    });

    const verificationToken = generateToken();
    await this.emailVerificationRepo.create({
      userId: user.id,
      token: verificationToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await emailService.sendVerificationEmail(user.email, verificationToken);

    const tokens = await this.issueTokens(user, meta);

    await auditService.log('CREATE', 'User', user.id, {
      userId: user.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    }, undefined, { email: user.email });

    return { user: this.toAuthUser(user), tokens };
  }

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string }): Promise<{
    user: AuthUser;
    tokens: AuthTokens;
  }> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    await this.userRepo.updateLastLogin(user.id);
    const tokens = await this.issueTokens(user, meta);

    await auditService.log('LOGIN', 'User', user.id, {
      userId: user.id,
      ipAddress: meta?.ip,
      userAgent: meta?.userAgent,
    });

    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(refreshToken: string, meta?: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const stored = await this.refreshTokenRepo.findByToken(refreshToken);
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await this.userRepo.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    await this.refreshTokenRepo.revoke(refreshToken);
    return this.issueTokens(user, meta);
  }

  async logout(refreshToken: string, userId?: string, meta?: { ip?: string; userAgent?: string }): Promise<void> {
    const stored = await this.refreshTokenRepo.findByToken(refreshToken);
    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepo.revoke(refreshToken);
    }

    if (userId) {
      await auditService.log('LOGOUT', 'User', userId, {
        userId,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      });
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return; // silent — don't reveal if email exists

    await this.passwordResetRepo.invalidateForUser(user.id);
    const token = generateToken();
    await this.passwordResetRepo.create({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await emailService.sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const reset = await this.passwordResetRepo.findByToken(dto.token);
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(dto.password);
    await this.userRepo.update(reset.userId, { passwordHash });
    await this.passwordResetRepo.markUsed(reset.id);
    await this.refreshTokenRepo.revokeAllForUser(reset.userId);
  }

  async verifyEmail(token: string): Promise<void> {
    const verification = await this.emailVerificationRepo.findByToken(token);
    if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired verification token');
    }

    await this.userRepo.verifyEmail(verification.userId);
    await this.emailVerificationRepo.markUsed(verification.id);
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    return this.toAuthUser(user);
  }

  private async issueTokens(
    user: { id: string; email: string; role: Role; organizationId: string | null },
    meta?: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? undefined,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken({ sub: user.id });

    await this.refreshTokenRepo.create({
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + parseExpiresIn(jwtConfig.refreshExpiresIn)),
      userAgent: meta?.userAgent,
      ipAddress: meta?.ip,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtConfig.accessExpiresIn,
    };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    isEmailVerified: boolean;
    avatarUrl: string | null;
    organizationId: string | null;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId,
    };
  }
}

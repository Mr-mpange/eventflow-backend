import { UserRepository } from '@modules/auth/repositories/UserRepository';
import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { hashPassword, verifyPassword } from '@/shared/utils/password';
import { cloudinaryService } from '@/infrastructure/storage/CloudinaryService';
import { NotFoundError, UnauthorizedError, ValidationError } from '@/shared/errors/AppError';
import { auditService } from '@/shared/services/AuditService';
import type { UpdateProfileDto, ChangePasswordDto, UpdateOrganizationDto } from '../validators/user.validator';

export class UserService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly orgRepo: OrganizationRepository,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    const updated = await this.userRepo.update(userId, dto);
    await auditService.log('UPDATE', 'User', userId, { userId }, {
      firstName: user.firstName,
      lastName: user.lastName,
    }, dto as Record<string, unknown>);

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      avatarUrl: updated.avatarUrl,
      role: updated.role,
    };
  }

  async uploadAvatar(userId: string, buffer: Buffer) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    const result = await cloudinaryService.uploadImage(buffer, 'avatars', userId);
    const updated = await this.userRepo.update(userId, { avatarUrl: result.url });

    return { avatarUrl: updated.avatarUrl };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    const valid = await verifyPassword(user.passwordHash, dto.currentPassword);
    if (!valid) throw new UnauthorizedError('Current password is incorrect');

    const passwordHash = await hashPassword(dto.newPassword);
    await this.userRepo.update(userId, { passwordHash });
    await auditService.log('UPDATE', 'User', userId, { userId }, undefined, { action: 'password_change' });
  }

  async getOrganization(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    if (!user.organizationId) {
      return null;
    }

    return this.orgRepo.findById(user.organizationId);
  }

  async createOrganization(userId: string, name: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    if (user.organizationId) {
      throw new ValidationError('User already belongs to an organization');
    }

    const org = await this.orgRepo.create({ name });
    await this.userRepo.update(userId, { organization: { connect: { id: org.id } } });

    await auditService.log('CREATE', 'Organization', org.id, { userId }, undefined, { name });
    return org;
  }

  async updateOrganization(userId: string, dto: UpdateOrganizationDto) {
    const user = await this.userRepo.findById(userId);
    if (!user?.organizationId) throw new NotFoundError('Organization');

    const org = await this.orgRepo.update(user.organizationId, {
      ...dto,
      website: dto.website || null,
    });

    await auditService.log('UPDATE', 'Organization', org.id, { userId }, undefined, dto as Record<string, unknown>);
    return org;
  }
}

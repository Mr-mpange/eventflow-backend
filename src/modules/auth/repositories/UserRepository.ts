import { prisma } from '@/config/database';
import { User, Prisma, Role } from '@prisma/client';

export type CreateUserData = Prisma.UserCreateInput;
export type UpdateUserData = Prisma.UserUpdateInput;

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async create(data: CreateUserData): Promise<User> {
    return prisma.user.create({ data });
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async verifyEmail(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { isEmailVerified: true, emailVerifiedAt: new Date() },
    });
  }

  async findByOrganization(organizationId: string): Promise<User[]> {
    return prisma.user.findMany({
      where: { organizationId, deletedAt: null },
    });
  }

  async countByRole(role: Role): Promise<number> {
    return prisma.user.count({ where: { role, deletedAt: null } });
  }
}

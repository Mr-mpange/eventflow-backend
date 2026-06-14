import { prisma } from '@/config/database';
import { Organization, Prisma } from '@prisma/client';
import { generateSlug } from '@/shared/utils/helpers';

export class OrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return prisma.organization.findFirst({
      where: { slug, deletedAt: null },
    });
  }

  async create(data: { name: string }): Promise<Organization> {
    const baseSlug = generateSlug(data.name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.findBySlug(slug)) {
      slug = `${baseSlug}-${counter++}`;
    }

    return prisma.organization.create({
      data: { name: data.name, slug },
    });
  }

  async update(id: string, data: Prisma.OrganizationUpdateInput): Promise<Organization> {
    return prisma.organization.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<Organization> {
    return prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

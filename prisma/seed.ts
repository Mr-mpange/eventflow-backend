import { PrismaClient, Role, SubscriptionPlan } from '@prisma/client';
import { hashPassword } from '../src/shared/utils/password';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const categories = [
    { name: 'Wedding', slug: 'wedding', description: 'Wedding ceremonies and receptions', icon: '💒' },
    { name: 'Birthday', slug: 'birthday', description: 'Birthday celebrations', icon: '🎂' },
    { name: 'Corporate', slug: 'corporate', description: 'Corporate events and conferences', icon: '🏢' },
    { name: 'Graduation', slug: 'graduation', description: 'Graduation ceremonies', icon: '🎓' },
  ];

  for (const cat of categories) {
    await prisma.eventCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  const templates = [
    {
      name: 'Classic Elegance',
      description: 'Timeless wedding invitation with gold accents',
      design: { theme: 'classic', colors: ['#D4AF37', '#FFFFFF'], font: 'Playfair Display' },
      isPublic: true,
    },
    {
      name: 'Modern Minimal',
      description: 'Clean minimalist design',
      design: { theme: 'modern', colors: ['#1A1A2E', '#E94560'], font: 'Inter' },
      isPublic: true,
    },
    {
      name: 'Floral Garden',
      description: 'Botanical themed invitation',
      design: { theme: 'floral', colors: ['#2D6A4F', '#F8F9FA'], font: 'Cormorant Garamond' },
      isPublic: true,
    },
  ];

  for (const tmpl of templates) {
    const existing = await prisma.invitationTemplate.findFirst({ where: { name: tmpl.name } });
    if (!existing) {
      await prisma.invitationTemplate.create({ data: tmpl });
    }
  }

  const adminPassword = await hashPassword('Admin@123456');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@eventflow.app' },
    update: {},
    create: {
      email: 'admin@eventflow.app',
      passwordHash: adminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: 'eventflow-demo' },
    update: {},
    create: { name: 'EventFlow Demo', slug: 'eventflow-demo' },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { organizationId: org.id },
  });

  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: org.id,
      plan: SubscriptionPlan.PREMIUM,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seed completed.');
  console.log('Admin: admin@eventflow.app / Admin@123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

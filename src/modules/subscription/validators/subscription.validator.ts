import { z } from 'zod';

export const upgradePlanSchema = z.object({
  plan: z.enum(['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE']),
});

export type UpgradePlanDto = z.infer<typeof upgradePlanSchema>;

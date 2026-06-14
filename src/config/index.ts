import { env } from './env';

export const jwtConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
} as const;

export const subscriptionPlans = {
  FREE: {
    name: 'Free',
    maxEvents: 1,
    maxGuests: 50,
    maxMessages: 100,
    price: 0,
  },
  BASIC: {
    name: 'Basic',
    maxEvents: 5,
    maxGuests: 200,
    maxMessages: 500,
    price: 19.99,
  },
  PREMIUM: {
    name: 'Premium',
    maxEvents: 20,
    maxGuests: 1000,
    maxMessages: 2000,
    price: 49.99,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    maxEvents: -1,
    maxGuests: -1,
    maxMessages: -1,
    price: 149.99,
  },
} as const;

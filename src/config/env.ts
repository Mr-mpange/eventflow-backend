import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_VERSION: z.string().default('v1'),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  APP_PUBLIC_URL: z.string().url().optional(),
  API_PUBLIC_URL: z.string().url().optional(),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('EventFlow <noreply@eventflow.app>'),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  GHALA_RAILS_API_URL: z.string().url().optional(),
  GHALA_RAILS_JWT: z.string().optional(),
  GHALA_RAILS_CREDENTIAL_ID: z.coerce.number().optional(),
  GHALA_RAILS_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  GHALARAILS_API_KEY: z.string().optional(),

  BRIQ_SMS_BASE_URL: z.string().url().optional(),
  BRIQ_SMS_SEND_PATH: z.string().optional(),
  BRIQ_SMS_API_KEY: z.string().optional(),
  BRIQ_SMS_SENDER_ID: z.string().optional(),
  BRIQ_SMS_AUTH_HEADER: z.string().optional(),
  BRIQ_SMS_AUTH_SCHEME: z.string().optional(),
  BRIQ_API_KEY: z.string().optional(),

  SNIPPE_API_KEY: z.string().optional(),
  SNIPPE_BASE_URL: z.string().url().optional(),
  SNIPPE_WEBHOOK_SECRET: z.string().optional(),

  MCP_SERVER_URL: z.string().url().optional(),
  MCP_AUTH_MODE: z.enum(['bearer', 'api_key']).default('bearer'),
  MCP_BEARER_TOKEN: z.string().optional(),

  SARUFI_BASE_URL: z.string().url().optional(),
  SARUFI_AGENT_ID: z.string().optional(),
  SARUFI_WORKSPACE_ID: z.string().optional(),
  SARUFI_OAUTH_CLIENT_ID: z.string().optional(),
  SARUFI_OAUTH_CLIENT_SECRET: z.string().optional(),
  SARUFI_API_KEY: z.string().optional(),
  SARUFI_ACCESS_TOKEN: z.string().optional(),
  SARUFI_REFRESH_TOKEN: z.string().optional(),
  SARUFI_WEBHOOK_SECRET: z.string().optional(),

  CSRF_SECRET: z.string().min(32).optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }

  return {
    ...result.data,
    APP_PUBLIC_URL: result.data.APP_PUBLIC_URL ?? result.data.APP_URL,
    API_PUBLIC_URL: result.data.API_PUBLIC_URL ?? result.data.APP_URL,
  };
}

export const env = loadEnv();

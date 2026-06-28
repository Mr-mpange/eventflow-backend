import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });
dotenv.config();

// Set test defaults if env vars missing
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://eventflow:eventflow_secret@localhost:5432/eventflow_test';
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-min-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-min-32-chars-long!';
process.env.BRIQ_SMS_BASE_URL = process.env.BRIQ_SMS_BASE_URL ?? 'https://briq.example.test';
process.env.BRIQ_SMS_SEND_PATH = process.env.BRIQ_SMS_SEND_PATH ?? '/v1/message/send-instant';
process.env.BRIQ_SMS_API_KEY = process.env.BRIQ_SMS_API_KEY ?? 'test-briq-key';
process.env.BRIQ_SMS_SENDER_ID = process.env.BRIQ_SMS_SENDER_ID ?? 'BRIQ';
process.env.BRIQ_SMS_AUTH_HEADER = process.env.BRIQ_SMS_AUTH_HEADER ?? 'X-API-Key';
process.env.BRIQ_SMS_AUTH_SCHEME = process.env.BRIQ_SMS_AUTH_SCHEME ?? '';

jest.setTimeout(30000);

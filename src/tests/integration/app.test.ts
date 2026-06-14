import request from 'supertest';
import { createApp } from '@/app';

describe('Health Check', () => {
  const app = createApp();

  it('GET /health should return ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth Routes', () => {
  const app = createApp();

  it('POST /api/v1/auth/register should validate input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'invalid', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/v1/auth/login should validate input', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/v1/auth/me should require auth', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('API Documentation', () => {
  const app = createApp();

  it('GET /api-docs.json should return OpenAPI spec', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.0');
    expect(res.body.info.title).toBe('EventFlow API');
  });
});

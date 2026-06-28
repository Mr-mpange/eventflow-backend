# EventFlow Backend - Production Deployment Guide

## Prerequisites

- Docker 24+ and Docker Compose v2
- PostgreSQL 16 (or use containerized)
- Redis 7 (or use containerized)
- Domain with SSL certificate
- Cloudinary account
- GhalaRails WhatsApp API credentials
- SMTP provider (SendGrid, Mailgun, etc.)

## Quick Start (Development)

```bash
# Clone and setup
cd eventflow-backend
cp .env.example .env

# Start all services
docker compose up -d

# API available at http://localhost:3000
# Swagger docs at http://localhost:3000/api-docs
```

## Environment Variables

Copy `.env.example` to `.env` and configure all production values. Critical secrets:

| Variable | Description |
|----------|-------------|
| `JWT_ACCESS_SECRET` | Min 32 chars, cryptographically random |
| `JWT_REFRESH_SECRET` | Min 32 chars, different from access secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `CLOUDINARY_*` | Image upload credentials |
| `GHALA_RAILS_API_KEY` | WhatsApp messaging |

Generate secrets:
```bash
openssl rand -hex 32
```

## Production Deployment

### Google Cloud Run / Cloud Build

This repository is already structured for Google Cloud deployment:
- `cloudbuild.yaml` builds and deploys `eventflow-api` and `eventflow-worker`
- `deploy/cloud-run-api.yaml` defines the API service
- `deploy/cloud-run-worker.yaml` defines the worker service

Required Secret Manager secrets for the new payment-agent flow:

| Secret name | Env var |
|----------|-------------|
| `eventflow-app-public-url` | `APP_PUBLIC_URL` |
| `eventflow-api-public-url` | `API_PUBLIC_URL` |
| `eventflow-mcp-bearer-token` | `MCP_BEARER_TOKEN` |
| `eventflow-snippe-base-url` | `SNIPPE_BASE_URL` |
| `eventflow-snippe-api-key` | `SNIPPE_API_KEY` |
| `eventflow-snippe-webhook` | `SNIPPE_WEBHOOK_SECRET` |
| `eventflow-sarufi-base-url` | `SARUFI_BASE_URL` |
| `eventflow-sarufi-agent-id` | `SARUFI_AGENT_ID` |
| `eventflow-sarufi-workspace-id` | `SARUFI_WORKSPACE_ID` |
| `eventflow-sarufi-client-id` | `SARUFI_OAUTH_CLIENT_ID` |
| `eventflow-sarufi-client-secret` | `SARUFI_OAUTH_CLIENT_SECRET` |
| `eventflow-sarufi-api-key` | `SARUFI_API_KEY` |
| `eventflow-sarufi-access-token` | `SARUFI_ACCESS_TOKEN` |
| `eventflow-sarufi-refresh-token` | `SARUFI_REFRESH_TOKEN` |
| `eventflow-sarufi-webhook` | `SARUFI_WEBHOOK_SECRET` |

Non-secret runtime setting used in Cloud Run:
- `MCP_AUTH_MODE=bearer`

Create or update the new secrets in Google Cloud:

```bash
printf '%s' 'https://your-public-api.example.com' | gcloud secrets create eventflow-api-public-url --data-file=-
printf '%s' 'https://your-public-app.example.com' | gcloud secrets create eventflow-app-public-url --data-file=-
printf '%s' 'your-mcp-bearer-token' | gcloud secrets create eventflow-mcp-bearer-token --data-file=-
printf '%s' 'https://api.sarufi.io' | gcloud secrets create eventflow-sarufi-base-url --data-file=-
printf '%s' 'sarufi-agent-id' | gcloud secrets create eventflow-sarufi-agent-id --data-file=-
printf '%s' 'sarufi-workspace-id' | gcloud secrets create eventflow-sarufi-workspace-id --data-file=-
printf '%s' 'oauth-client-id' | gcloud secrets create eventflow-sarufi-client-id --data-file=-
printf '%s' 'oauth-client-secret' | gcloud secrets create eventflow-sarufi-client-secret --data-file=-
printf '%s' 'sarufi-api-key' | gcloud secrets create eventflow-sarufi-api-key --data-file=-
printf '%s' 'access-token' | gcloud secrets create eventflow-sarufi-access-token --data-file=-
printf '%s' 'refresh-token' | gcloud secrets create eventflow-sarufi-refresh-token --data-file=-
printf '%s' 'sarufi-webhook-secret' | gcloud secrets create eventflow-sarufi-webhook --data-file=-
printf '%s' 'https://snippe.example.com' | gcloud secrets create eventflow-snippe-base-url --data-file=-
printf '%s' 'snippe-api-key' | gcloud secrets create eventflow-snippe-api-key --data-file=-
printf '%s' 'snippe-webhook-secret' | gcloud secrets create eventflow-snippe-webhook --data-file=-
```

If a secret already exists, add a new version instead:

```bash
printf '%s' 'new-value' | gcloud secrets versions add eventflow-sarufi-access-token --data-file=-
```

### Option 1: Docker Compose (Single Server)

```bash
# Create production env file
cp .env.example .env.production
# Edit with production values

# Deploy
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

# Run migrations
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

# Seed initial data (first deploy only)
docker compose -f docker-compose.prod.yml exec api npx prisma db seed
```

### Option 2: Kubernetes

1. Build and push images via CI/CD pipeline
2. Create secrets for env variables
3. Deploy PostgreSQL (or use managed RDS/Cloud SQL)
4. Deploy Redis (or use managed ElastiCache/Memorystore)
5. Deploy API deployment (2+ replicas)
6. Deploy Worker deployment (1+ replicas)
7. Configure Ingress with TLS

### Option 3: Cloud PaaS (Railway, Render, Fly.io)

1. Connect repository
2. Set environment variables in dashboard
3. Add PostgreSQL and Redis add-ons
4. Deploy API service from `production` Docker target
5. Deploy Worker service from `worker` Docker target

## Database Migrations

```bash
# Development
npm run prisma:migrate

# Production (never use migrate dev)
npm run prisma:migrate:prod
```

Always backup database before running production migrations.

## SSL/TLS

Place certificates in `./certs/` for nginx:
- `fullchain.pem`
- `privkey.pem`

Use Let's Encrypt with certbot for automatic renewal.

## Monitoring

### Health Check
```
GET /health
```

### Recommended Stack
- **APM**: Datadog, New Relic, or Grafana Cloud
- **Logs**: ELK stack or CloudWatch
- **Uptime**: UptimeRobot or Pingdom
- **Errors**: Sentry

### Key Metrics
- API response time (p50, p95, p99)
- Error rate by endpoint
- Queue depth (BullMQ)
- Database connection pool usage
- Redis memory usage
- WhatsApp delivery success rate

## Scaling

| Component | Scale Strategy |
|-----------|---------------|
| API | Horizontal (stateless, behind LB) |
| Worker | Horizontal (BullMQ handles distribution) |
| PostgreSQL | Vertical + read replicas |
| Redis | Redis Cluster for HA |

## Backup Strategy

- **PostgreSQL**: Daily automated backups, 30-day retention
- **Redis**: AOF persistence enabled
- **Cloudinary**: Managed by provider

## Security Checklist

- [ ] All secrets in environment variables (never in code)
- [ ] HTTPS enforced via nginx/load balancer
- [ ] Rate limiting enabled
- [ ] CORS restricted to frontend domain
- [ ] Database not publicly accessible
- [ ] Redis password protected
- [ ] Regular dependency updates (`npm audit`)
- [ ] Audit logs reviewed periodically

## Rollback Procedure

1. Revert to previous Docker image tag
2. If migration was applied, run down migration or restore DB backup
3. Verify health endpoint
4. Monitor error rates

## Default Admin Credentials (Seed)

After seeding:
- Email: `admin@eventflow.app`
- Password: `Admin@123456`

**Change immediately in production.**

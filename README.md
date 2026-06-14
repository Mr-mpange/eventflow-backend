# EventFlow API

Production-ready backend for the EventFlow Wedding & Event Invitation Management Platform.

## Tech Stack

- **Runtime**: Node.js 20 LTS, TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Auth**: JWT + Refresh Tokens (Argon2)
- **Storage**: Cloudinary
- **Messaging**: WhatsApp via GhalaRails
- **Docs**: Swagger/OpenAPI 3.0

## Getting Started

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

API: http://localhost:3000/api/v1  
Docs: http://localhost:3000/api-docs

## API Modules

| Module | Base Path | Description |
|--------|-----------|-------------|
| Auth | `/auth` | Register, login, JWT, password reset |
| Users | `/users` | Profile, avatar, organization |
| Events | `/events` | CRUD, settings, categories |
| Invitations | `/invitations` | Templates, design, publish |
| Guests | `/guests` | CRUD, CSV import/export, groups |
| RSVP | `/rsvp` | Accept/decline/maybe responses |
| QR | `/qr` | Generate, verify, check-in |
| WhatsApp | `/whatsapp` | Bulk messaging, campaigns |
| Analytics | `/analytics` | RSVP, attendance, message stats |
| Subscriptions | `/subscriptions` | Plans, billing, invoices |

## Architecture

Clean Architecture with DDD, Repository Pattern, Service Layer, and Dependency Injection.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for full details.

## Testing

```bash
npm test
npm run test:coverage
```

## Docker

```bash
docker compose up -d          # Development
docker compose -f docker-compose.prod.yml up -d  # Production
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database ERD](docs/ERD.md)
- [Folder Structure](docs/FOLDER_STRUCTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

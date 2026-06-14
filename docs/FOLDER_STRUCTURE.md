# EventFlow Folder Structure

```
eventflow-backend/
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # CI/CD pipeline
├── docs/
│   ├── ARCHITECTURE.md            # System architecture
│   ├── DEPLOYMENT.md              # Production deployment guide
│   └── ERD.md                     # Database ERD
├── prisma/
│   ├── schema.prisma              # Full database schema
│   └── seed.ts                    # Database seed script
├── src/
│   ├── app.ts                     # Express app factory
│   ├── server.ts                  # API server entry point
│   ├── worker.ts                  # BullMQ worker entry point
│   ├── config/
│   │   ├── database.ts            # Prisma client
│   │   ├── env.ts                 # Environment validation (Zod)
│   │   ├── index.ts               # App configuration
│   │   ├── redis.ts               # Redis client
│   │   └── swagger.ts             # OpenAPI specification
│   ├── infrastructure/
│   │   ├── email/
│   │   │   └── EmailService.ts    # Nodemailer SMTP
│   │   ├── storage/
│   │   │   └── CloudinaryService.ts
│   │   └── whatsapp/
│   │       └── GhalaRailsService.ts
│   ├── jobs/
│   │   └── whatsapp.processor.ts  # BullMQ job processors
│   ├── middleware/
│   │   ├── auth.ts                # JWT auth + RBAC
│   │   ├── errorHandler.ts        # Global error handler
│   │   ├── rateLimiter.ts         # Rate limiting
│   │   └── validate.ts            # Zod validation middleware
│   ├── modules/
│   │   ├── analytics/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── auth/
│   │   │   ├── __tests__/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   ├── event/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   ├── guest/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   ├── invitation/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   ├── qr/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   └── services/
│   │   ├── rsvp/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   ├── subscription/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   ├── user/
│   │   │   ├── controllers/
│   │   │   ├── repositories/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── validators/
│   │   └── whatsapp/
│   │       ├── controllers/
│   │       ├── repositories/
│   │       ├── routes/
│   │       ├── services/
│   │       └── validators/
│   ├── queues/
│   │   └── whatsapp.queue.ts      # BullMQ queue definition
│   ├── shared/
│   │   ├── container.ts           # Dependency injection
│   │   ├── errors/
│   │   │   └── AppError.ts        # Custom error classes
│   │   ├── services/
│   │   │   └── AuditService.ts    # Audit logging
│   │   └── utils/
│   │       ├── helpers.ts
│   │       ├── jwt.ts
│   │       └── password.ts
│   └── tests/
│       ├── integration/
│       │   └── app.test.ts
│       └── setup.ts
├── .env.example
├── .gitignore
├── docker-compose.yml             # Development compose
├── docker-compose.prod.yml        # Production compose
├── Dockerfile                     # Multi-stage build
├── jest.config.ts
├── nginx.conf                     # Production reverse proxy
├── package.json
└── tsconfig.json
```

## Module Pattern

Every feature module follows the same structure:

```
modules/{name}/
├── controllers/    # HTTP request handlers
├── services/       # Business logic
├── repositories/   # Data access (Prisma)
├── routes/         # Express routes + Swagger annotations
├── validators/     # Zod schemas (DTOs)
└── __tests__/      # Unit/integration tests
```

# EventFlow System Architecture

## Overview

EventFlow is a multi-tenant SaaS platform for wedding and event invitation management. The backend follows **Clean Architecture** with **Domain-Driven Design (DDD)** principles, ensuring separation of concerns, testability, and maintainability.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Controllers │  │   Routes    │  │ Middleware  │  │  Swagger UI  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────────────┘
          │                │                │
┌─────────▼────────────────▼────────────────▼────────────────────────────┐
│                         APPLICATION LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │  Services   │  │    DTOs     │  │ Validators  │  │  Use Cases   │   │
│  └──────┬──────┘  └─────────────┘  └─────────────┘  └──────────────┘   │
└─────────┼──────────────────────────────────────────────────────────────┘
          │
┌─────────▼──────────────────────────────────────────────────────────────┐
│                           DOMAIN LAYER                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │  Entities   │  │  Interfaces │  │   Enums     │  │ Domain Events│   │
│  └─────────────┘  └──────┬──────┘  └─────────────┘  └──────────────┘   │
└──────────────────────────┼─────────────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │ Repositories│  │   Prisma    │  │  Cloudinary │  │ GhalaRails   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐   │
│  │    Redis    │  │   BullMQ    │  │   Nodemailer│  │   QRCode     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Presentation Layer
- **Controllers**: Handle HTTP requests/responses, delegate to services
- **Routes**: Define API endpoints with middleware chains
- **Middleware**: Auth, validation, rate limiting, error handling
- **Swagger**: Auto-generated OpenAPI documentation

### Application Layer
- **Services**: Business logic orchestration
- **DTOs**: Data transfer objects for API contracts
- **Validators**: Zod schemas for input validation

### Domain Layer
- **Entities**: Core business objects
- **Interfaces**: Repository and service contracts
- **Enums**: Domain-specific enumerations

### Infrastructure Layer
- **Repositories**: Prisma-based data access
- **External Services**: Cloudinary, WhatsApp, Email
- **Queues**: BullMQ job processing
- **Cache**: Redis caching layer

## Request Flow

```
Client Request
    │
    ▼
Rate Limiter → Helmet → CORS → Body Parser
    │
    ▼
Auth Middleware (JWT validation)
    │
    ▼
RBAC Middleware (role check)
    │
    ▼
Validation Middleware (Zod)
    │
    ▼
Controller → Service → Repository → Database
    │
    ▼
Response / Error Handler
```

## Module Structure

Each module follows the same pattern:

```
modules/{module}/
├── controllers/
├── services/
├── repositories/
├── routes/
├── dtos/
├── validators/
└── __tests__/
```

## Key Architectural Decisions

### 1. Dependency Injection
A lightweight DI container (`shared/container.ts`) wires dependencies at startup. Services receive repositories via constructor injection, enabling easy mocking in tests.

### 2. Repository Pattern
All database access goes through repository interfaces. Prisma implementations live in `infrastructure/repositories/`. This isolates the domain from ORM specifics.

### 3. Soft Deletes
Entities with `deletedAt` use soft deletion. Repositories filter `deletedAt: null` by default.

### 4. Audit Logging
All mutating operations write to `audit_logs` via `AuditService`. Captures user, action, entity, and before/after values.

### 5. Messaging Architecture
- WhatsApp messages are asynchronous and go through BullMQ with retry logic (3 attempts, exponential backoff).
- Normal SMS sends use the external Briq provider through a dedicated infrastructure client.
- External messaging channels are exposed behind API-key-authenticated routes under `/api/v1/external/*`.

### 6. JWT + Refresh Token Rotation
- Access tokens: 15 minutes, stateless
- Refresh tokens: 7 days, stored in DB, rotated on use
- Logout revokes refresh token

### 7. Multi-Tenancy via Organizations
Users belong to organizations. Events and subscriptions are scoped to organizations. RBAC controls cross-organization access.

### 8. Caching Strategy
- Event details: 5 min TTL
- Analytics aggregates: 10 min TTL
- User sessions: Redis-backed token blacklist

## Security Architecture

| Layer | Protection |
|-------|-----------|
| Transport | HTTPS (production) |
| Headers | Helmet (CSP, HSTS, X-Frame) |
| Auth | JWT + Refresh rotation |
| Passwords | Argon2id hashing |
| Input | Zod validation |
| SQL | Prisma parameterized queries |
| XSS | Input sanitization + CSP |
| CSRF | Double-submit cookie pattern |
| Rate Limit | 100 req/15min per IP |
| Audit | Full mutation logging |

## Scalability Considerations

- **Horizontal scaling**: Stateless API servers behind load balancer
- **Worker processes**: Separate BullMQ workers for message processing
- **Database**: Connection pooling via Prisma, read replicas ready
- **Cache**: Redis cluster for high availability
- **Storage**: Cloudinary CDN for images

## Technology Choices Rationale

| Choice | Rationale |
|--------|-----------|
| Express.js | Mature ecosystem, middleware flexibility |
| Prisma | Type-safe ORM, excellent migrations |
| BullMQ | Reliable job queue with Redis backend |
| Argon2 | OWASP-recommended password hashing |
| Zod | Runtime validation with TypeScript inference |
| Jest + Supertest | Industry standard for Node.js testing |

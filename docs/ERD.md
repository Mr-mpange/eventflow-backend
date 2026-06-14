# EventFlow Database ERD

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ RefreshToken : has
    User ||--o{ PasswordReset : has
    User ||--o{ EmailVerification : has
    User ||--o{ Event : organizes
    User ||--o{ AuditLog : performs
    User }o--o| Organization : belongs_to

    Organization ||--o{ User : has
    Organization ||--o{ Event : owns
    Organization ||--o{ Subscription : has

    EventCategory ||--o{ Event : categorizes
    Event ||--o{ Invitation : has
    Event ||--o{ Guest : has
    Event ||--o{ GuestGroup : has
    Event ||--o{ WhatsAppCampaign : has
    Event ||--o{ AttendanceLog : tracks

    InvitationTemplate ||--o{ Invitation : uses
    Invitation }o--|| Event : belongs_to

    GuestGroup ||--o{ Guest : contains
    Guest ||--o{ RsvpResponse : submits
    Guest ||--o{ WhatsAppMessage : receives
    Guest ||--o{ AttendanceLog : logs

    WhatsAppTemplate ||--o{ WhatsAppCampaign : uses
    WhatsAppCampaign ||--o{ WhatsAppMessage : sends

    Subscription ||--o{ Invoice : generates
    Subscription }o--|| Organization : belongs_to

    User {
        uuid id PK
        string email UK
        string password_hash
        string first_name
        string last_name
        enum role
        boolean is_email_verified
        uuid organization_id FK
        timestamp deleted_at
    }

    Organization {
        uuid id PK
        string name
        string slug UK
        string logo_url
        timestamp deleted_at
    }

    Event {
        uuid id PK
        string title
        datetime event_date
        string venue
        float latitude
        float longitude
        enum status
        json settings
        uuid organizer_id FK
        uuid organization_id FK
        uuid category_id FK
        timestamp deleted_at
    }

    Guest {
        uuid id PK
        string full_name
        string phone
        string email
        enum rsvp_status
        string qr_code UK
        boolean is_checked_in
        uuid event_id FK
        uuid group_id FK
        timestamp deleted_at
    }

    Invitation {
        uuid id PK
        string title
        json content
        enum status
        uuid event_id FK
        uuid template_id FK
        timestamp deleted_at
    }

    WhatsAppMessage {
        uuid id PK
        string phone
        string message
        enum status
        int retry_count
        uuid guest_id FK
        uuid campaign_id FK
    }

    Subscription {
        uuid id PK
        enum plan
        enum status
        uuid organization_id FK
    }

    AuditLog {
        uuid id PK
        enum action
        string entity_type
        uuid entity_id
        json old_values
        json new_values
        uuid user_id FK
    }
```

## Relationships Summary

| Parent | Child | Type | On Delete |
|--------|-------|------|-----------|
| User | RefreshToken | 1:N | Cascade |
| User | Event | 1:N | Restrict |
| Organization | User | 1:N | Set Null |
| Organization | Event | 1:N | Set Null |
| Organization | Subscription | 1:N | Restrict |
| Event | Guest | 1:N | Cascade |
| Event | Invitation | 1:N | Cascade |
| Event | GuestGroup | 1:N | Cascade |
| Guest | RsvpResponse | 1:N | Cascade |
| Guest | WhatsAppMessage | 1:N | Cascade |
| Guest | AttendanceLog | 1:N | Cascade |
| Subscription | Invoice | 1:N | Restrict |

## Indexes

Critical indexes for query performance:

- `users.email` — login lookups
- `users.organization_id` — tenant scoping
- `events.organizer_id, events.status` — dashboard queries
- `events.event_date` — calendar views
- `guests.event_id, guests.rsvp_status` — RSVP analytics
- `guests.qr_code` — check-in scanning
- `whatsapp_messages.status` — delivery tracking
- `audit_logs.entity_type, entity_id` — audit queries
- `audit_logs.created_at` — time-range queries

## Soft Delete Strategy

Tables with `deleted_at`:
- users, organizations, events, guests, guest_groups
- invitations, invitation_templates, whatsapp_templates, whatsapp_campaigns

Soft-deleted records are excluded from all queries via repository base class.

## Audit Tables

`audit_logs` captures all mutations with:
- Actor (user_id)
- Action (CREATE, UPDATE, DELETE, etc.)
- Entity reference (type + id)
- Before/after JSON snapshots
- Request metadata (IP, user agent)

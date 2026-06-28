DO $$ BEGIN
  CREATE TYPE "AgentChannel" AS ENUM ('WHATSAPP', 'SMS', 'WEB');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentIntent" AS ENUM (
    'GREETING', 'EVENT_INFO', 'RSVP_YES', 'RSVP_NO', 'PAY_FULL', 'PAY_PARTIAL',
    'CHECK_BALANCE', 'MAKE_PLEDGE', 'REQUEST_INVITE_CARD', 'REQUEST_TICKET',
    'PAYMENT_STATUS', 'HUMAN_SUPPORT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentLanguage" AS ENUM ('SW', 'EN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentSessionStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentSender" AS ENUM ('USER', 'AGENT', 'SYSTEM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ContributionStatus" AS ENUM ('UNPAID', 'PARTIAL', 'COMPLETED', 'WAIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PledgeStatus" AS ENUM ('ACTIVE', 'PAID', 'MISSED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('ACTIVE', 'USED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payments" (
  "id" TEXT PRIMARY KEY,
  "event_id" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "guest_id" TEXT NOT NULL REFERENCES "guests"("id") ON DELETE CASCADE,
  "organizer_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'TZS',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL DEFAULT 'SNIPPE',
  "provider_reference" TEXT,
  "internal_reference" TEXT NOT NULL UNIQUE,
  "checkout_url" TEXT,
  "phone_number" TEXT,
  "payment_type" TEXT,
  "paid_at" TIMESTAMP(3),
  "failed_reason" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payments_event_id_idx" ON "payments"("event_id");
CREATE INDEX IF NOT EXISTS "payments_guest_id_idx" ON "payments"("guest_id");
CREATE INDEX IF NOT EXISTS "payments_organizer_id_idx" ON "payments"("organizer_id");
CREATE INDEX IF NOT EXISTS "payments_status_idx" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "payments_provider_reference_idx" ON "payments"("provider_reference");

CREATE TABLE IF NOT EXISTS "guest_contributions" (
  "id" TEXT PRIMARY KEY,
  "event_id" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "guest_id" TEXT NOT NULL REFERENCES "guests"("id") ON DELETE CASCADE,
  "required_amount" DECIMAL(12, 2) NOT NULL,
  "paid_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "remaining_amount" DECIMAL(12, 2) NOT NULL,
  "status" "ContributionStatus" NOT NULL DEFAULT 'UNPAID',
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("event_id", "guest_id")
);

CREATE INDEX IF NOT EXISTS "guest_contributions_status_idx" ON "guest_contributions"("status");

CREATE TABLE IF NOT EXISTS "pledges" (
  "id" TEXT PRIMARY KEY,
  "event_id" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "guest_id" TEXT NOT NULL REFERENCES "guests"("id") ON DELETE CASCADE,
  "amount" DECIMAL(12, 2) NOT NULL,
  "promised_date" TIMESTAMP(3) NOT NULL,
  "status" "PledgeStatus" NOT NULL DEFAULT 'ACTIVE',
  "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "pledges_event_id_idx" ON "pledges"("event_id");
CREATE INDEX IF NOT EXISTS "pledges_guest_id_idx" ON "pledges"("guest_id");
CREATE INDEX IF NOT EXISTS "pledges_status_promised_date_idx" ON "pledges"("status", "promised_date");

CREATE TABLE IF NOT EXISTS "tickets" (
  "id" TEXT PRIMARY KEY,
  "event_id" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "guest_id" TEXT NOT NULL REFERENCES "guests"("id") ON DELETE CASCADE,
  "ticket_token" TEXT NOT NULL UNIQUE,
  "qr_code_url" TEXT,
  "card_url" TEXT,
  "status" "TicketStatus" NOT NULL DEFAULT 'ACTIVE',
  "issued_at" TIMESTAMP(3),
  "checked_in_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("event_id", "guest_id")
);

CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets"("status");

CREATE TABLE IF NOT EXISTS "agent_sessions" (
  "id" TEXT PRIMARY KEY,
  "event_id" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "guest_id" TEXT NOT NULL REFERENCES "guests"("id") ON DELETE CASCADE,
  "channel" "AgentChannel" NOT NULL,
  "current_intent" "AgentIntent",
  "current_step" TEXT,
  "language" "AgentLanguage" NOT NULL DEFAULT 'SW',
  "status" "AgentSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "agent_sessions_event_id_idx" ON "agent_sessions"("event_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_guest_id_idx" ON "agent_sessions"("guest_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_status_idx" ON "agent_sessions"("status");

CREATE TABLE IF NOT EXISTS "agent_messages" (
  "id" TEXT PRIMARY KEY,
  "session_id" TEXT NOT NULL REFERENCES "agent_sessions"("id") ON DELETE CASCADE,
  "sender" "AgentSender" NOT NULL,
  "message" TEXT NOT NULL,
  "intent" "AgentIntent",
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "agent_messages_session_id_idx" ON "agent_messages"("session_id");
CREATE INDEX IF NOT EXISTS "agent_messages_created_at_idx" ON "agent_messages"("created_at");

CREATE TABLE IF NOT EXISTS "mcp_tool_calls" (
  "id" TEXT PRIMARY KEY,
  "tool_name" TEXT NOT NULL,
  "request_id" TEXT,
  "actor" TEXT,
  "success" BOOLEAN NOT NULL,
  "input" JSONB NOT NULL DEFAULT '{}',
  "output" JSONB DEFAULT '{}',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "mcp_tool_calls_tool_name_idx" ON "mcp_tool_calls"("tool_name");
CREATE INDEX IF NOT EXISTS "mcp_tool_calls_request_id_idx" ON "mcp_tool_calls"("request_id");
CREATE INDEX IF NOT EXISTS "mcp_tool_calls_created_at_idx" ON "mcp_tool_calls"("created_at");

-- Esquema de Unidos por una Patita (PostgreSQL).
-- Todas las tablas viven en el esquema «patita».
CREATE SCHEMA IF NOT EXISTS patita;

CREATE TABLE IF NOT EXISTS patita.admins (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text NOT NULL,
  full_name     text NOT NULL,
  role          text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','lector')),
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS admins_username_key ON patita.admins (lower(username));

CREATE TABLE IF NOT EXISTS patita.sessions (
  token_hash text PRIMARY KEY,
  admin_id   bigint NOT NULL REFERENCES patita.admins(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Intentos de inicio de sesión fallidos y límites de envío (funciona con varias instancias del servidor)
CREATE TABLE IF NOT EXISTS patita.rate_events (
  id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket text NOT NULL,
  at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rate_events_bucket_at ON patita.rate_events (bucket, at);

-- La identidad nunca reutiliza valores: cada número UPP es único.
CREATE TABLE IF NOT EXISTS patita.registrations (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                 text UNIQUE,
  idempotency_key      text UNIQUE,
  status               text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','aprobada','rechazada')),
  payment_received     boolean NOT NULL DEFAULT false,
  full_name            text NOT NULL,
  document_number      text,
  phone                text NOT NULL,
  email                text NOT NULL,
  neighborhood         text NOT NULL,
  business_name        text NOT NULL,
  manager_name         text NOT NULL,
  category             text NOT NULL,
  products_description text NOT NULL,
  social_media         text,
  photo_data           bytea,
  photo_type           text,
  products_to_bring    text NOT NULL,
  space_needed         text NOT NULL,
  needs_table          boolean NOT NULL,
  brings_own_table     boolean NOT NULL,
  needs_power          boolean NOT NULL,
  special_request      text,
  accepted_terms       boolean NOT NULL,
  accepted_data        boolean NOT NULL,
  accepted_truth       boolean NOT NULL,
  accepted_fee         boolean NOT NULL,
  fee_cop              integer NOT NULL,
  admin_notes          text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  reviewed_by          bigint REFERENCES patita.admins(id),
  reviewed_at          timestamptz
);
CREATE INDEX IF NOT EXISTS registrations_status   ON patita.registrations (status);
CREATE INDEX IF NOT EXISTS registrations_category ON patita.registrations (category);

CREATE TABLE IF NOT EXISTS patita.registration_history (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_id bigint NOT NULL REFERENCES patita.registrations(id) ON DELETE CASCADE,
  admin_id        bigint REFERENCES patita.admins(id),
  action          text NOT NULL,
  detail          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS registration_history_reg ON patita.registration_history (registration_id);

CREATE TABLE IF NOT EXISTS patita.settings (
  key   text PRIMARY KEY,
  value text
);

-- Medios públicos (fotografía de Luna)
CREATE TABLE IF NOT EXISTS patita.media (
  name       text PRIMARY KEY,
  mime       text NOT NULL,
  data       bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Required by later migrations that call gen_random_bytes() (e.g. org_invites token generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

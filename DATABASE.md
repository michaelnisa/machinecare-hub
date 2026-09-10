# MachineCare Database & Migration Guidelines

## Database Safety & Zero Data Loss Policy

1. **Non-Destructive Migrations Only:**
   - All migrations applied to production Supabase instances must be strictly **additive**.
   - Prohibited SQL statements: `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DROP DATABASE`.
2. **Nullable Columns for Schema Expansion:**
   - New columns added to existing tables must be nullable or have safe default values.
3. **Trigger & Profile Protection:**
   - Supabase auth triggers (such as `handle_new_user`) must remain intact to preserve automatic user registration and organization onboarding.
4. **Row-Level Security (RLS):**
   - Every new table must enable RLS:
     ```sql
     ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
     ```
   - Policies must restrict access based on the user's active `organisation_id`.

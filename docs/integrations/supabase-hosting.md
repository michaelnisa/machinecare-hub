# Deploying & Hosting ERP Integrations on Supabase

Since MachineCare is hosted on **Supabase**, you have two architectural options for hosting the ERP Integration Platform:

---

## Architecture Option A: 100% Native Supabase (Zero Extra Servers — Recommended)

In this mode, you do **not** need to deploy, pay for, or manage any separate Python servers. The entire ERP integration runs serverlessly inside your Supabase project.

```text
MachineCare Frontend (Vite/React)
             │
             ▼
Supabase Edge Functions (Deno / TypeScript)
 ├── /functions/v1/erp-sync (Live ping, OAuth, REST, Odoo JSON-2, SAP Service Layer)
 └── /functions/v1/erp-webhook-receiver (Inbound HMAC webhooks)
             │
             ▼
Supabase PostgreSQL Database (with RLS)
 ├── 11 Integration Tables (integrations, external_identities, sync_jobs)
 └── pg_cron (Automated background sync every 5m / 15m)
```

### Step 1: Push Database Migration to Remote Supabase
Run from repository root:
```bash
supabase db push
```
Or open the **Supabase Dashboard → SQL Editor** and paste the contents of:
[`supabase/migrations/20260930000000_erp_integration_platform.sql`](file:///home/michael/Downloads/MachineCare%20Hub%281%29/supabase/migrations/20260930000000_erp_integration_platform.sql)

### Step 2: Deploy Native Edge Functions
Deploy both functions with the Supabase CLI:
```bash
supabase functions deploy erp-sync --no-verify-jwt
supabase functions deploy erp-webhook-receiver --no-verify-jwt
```

### Step 3: Enable Automated Schedules via `pg_cron`
In your Supabase SQL Editor, run this snippet to schedule automated sync runs directly within PostgreSQL:
```sql
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule ERP sync every 15 minutes via pg_net HTTP call to Edge Function
SELECT cron.schedule(
  'erp-sync-15m-job',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/erp-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <your-anon-or-service-key>'
    ),
    body := jsonb_build_object(
      'action', 'trigger_sync',
      'entity_type', 'parts'
    )
  );
  $$
);
```

---

## Architecture Option B: Dedicated Python Worker Microservice

If you prefer to run the Python service (`backend/integrations/`) for heavy ETL pipelines, specialized scientific transformations, or on-premises deployments:

```text
MachineCare Frontend
        │
        ▼
Supabase PostgreSQL (Database of Record)
        ▲
        │ Direct SQL / Supabase REST
Python Sync Worker (FastAPI / Celery)
(Hosted on Render, Fly.io, Railway, or AWS ECS)
```

### Deploying the Python Container:
1. **Using Docker**:
   ```bash
   docker compose -f backend/docker-compose.yml up -d
   ```
2. **Deploying to Render / Railway / Fly.io**:
   * Root Directory: `.`
   * Dockerfile Path: `backend/Dockerfile`
   * Environment Variables:
     * `MACHINECARE_INTEGRATION_MASTER_KEY`: Strong 32-byte secret key.
     * `SUPABASE_URL`: Your Supabase Project URL.
     * `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role secret.
     * `PORT`: `8000`

---

## Feature Comparison Matrix

| Capability | Option A: Native Supabase Edge Functions | Option B: Python Worker Service |
|---|---|---|
| **Cost** | **$0 extra** (included in Supabase free/pro tier) | Additional hosting ($5-$20/mo per container) |
| **Server Management** | **Zero** (serverless, auto-scaling) | Requires managing container & uptime |
| **Setup Speed** | **1-minute CLI deploy** | Requires container registry & hosting setup |
| **Odoo 19 JSON-2** | Yes (`fetch()` in Deno) | Yes (`requests` / `httpx` in Python) |
| **SAP Business One** | Yes (`fetch()` with cookies) | Yes (`requests.Session()` with cookies) |
| **Dynamics 365 OAuth** | Yes (standard OAuth 2.0) | Yes (Azure AD client credentials) |
| **High-volume batch (500k+)** | Limited to 150s Edge Function timeout | Unlimited execution duration |

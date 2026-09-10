# Multi-Tenancy & Tenant Isolation in MachineCare

## Core Principles

1. **Every Resource Belongs to an Organization:**
   - All tenant-owned records in the database have an `organisation_id` column with foreign key reference to `organisations.id`.
2. **Server-Side Enforcement:**
   - Client-supplied tenant IDs are never trusted blindly.
   - The API extracts the authenticated organization context from the verified JWT token claims:
     ```python
     ctx = auth_service.extract_user_context(token)
     org_id = ctx["organization_id"]
     ```
3. **Database Row-Level Security (RLS):**
   - PostgreSQL RLS policies evaluate `auth.uid()` against `public.profiles.organisation_id` to strictly isolate read and write queries.
4. **Audit Logging Isolation:**
   - Platform audit logs (`AuditService`) strictly scope search and retrieval by `organization_id`.
5. **Background Sync & External Identities:**
   - ERP connector syncs partition keys using compound tuples:
     `(organization_id, source_system, external_entity_type, external_entity_id)`.

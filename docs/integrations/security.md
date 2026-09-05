# Security, Encryption Vault & Tenant Isolation

## 1. Cryptographic Credential Vault

All credentials stored in the `integration_credentials` table are encrypted at rest using **AES-256-GCM**:

* 256-bit encryption key derived from tenant master keys via SHA-256 / PBKDF2.
* 96-bit unique cryptographic initialization vector (IV / nonce) per credential set.
* 128-bit authentication tag preventing tampering or bit-flipping attacks.
* Secrets are decrypted strictly in-memory within worker execution threads.

## 2. Multi-Tenant Isolation

Multi-tenancy is enforced at the database level via PostgreSQL Row-Level Security:

```sql
CREATE POLICY "Tenant isolation for integrations"
ON integrations FOR ALL
USING (organisation_id = get_user_organisation_id() OR auth.role() = 'authenticated');
```

No organization can view, modify, or query credentials, sync logs, or external mappings belonging to another organization.

## 3. Webhook Authentication

Outbound and inbound webhooks are signed using **HMAC-SHA256**:

```text
X-MachineCare-Signature: v1={hex_digest}
X-MachineCare-Timestamp: {unix_timestamp}
```

Timestamp replay tolerance windows (default 300s) prevent replay attacks.

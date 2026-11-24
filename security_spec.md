# Firestore Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants

1. **Verified Authentication Gate:** All reads and writes to `/admins/{uid}` and `/licenses/{accountId}` require a signed-in user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **Grade-ID Mathematical Binding:** A student license document at `/licenses/l{G}_{N}` MUST have `grade == G` (where `G` is 1..9 and `N` is 3–5 digits representing `1..99999`), and `accountId == {accountId}`. A student cannot bind `l4_00001` to `grade: 9`.
3. **No Self-Assigned Admin Privilege:** A non-admin user can NEVER create `/admins/{uid}`, can NEVER create a license with `isAdminAccount: true`, and can NEVER create `/licenses/uyenlp1310`.
4. **Immutable 1-Year Expiration:** On student license creation, `activatedAt == request.time` and `expiresAt <= request.time + 366 days`. On student updates (session takeover), `activatedAt`, `expiresAt`, `grade`, `accountId`, `isAdminAccount`, and `status` are strictly immutable.
5. **Terminal Revoked State Lock:** Once an Admin sets `status: 'revoked'` on a license, no student can reactivate, update, or take over that license.
6. **Strict List Restriction (Anti-Scraping):** Only verified Admins may execute `list` queries on `/licenses` or `/admins`.
7. **Strict Key Allowlisting & Type/Size Bounds:** Every string has explicit `.size()` bounds and regex checks; shadow/ghost fields are rejected on both create and update.

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload / Operation | Expected Result |
|---|---|---|---|---|
| 1 | Unauthenticated Read/Write | `/licenses/l4_00001` | Read or write without `request.auth` | `PERMISSION_DENIED` |
| 2 | Unverified Admin Email Spoof | `/licenses` (list) | `email: "junvu1707@gmail.com"`, `email_verified: false` | `PERMISSION_DENIED` |
| 3 | Self-Assigned Admin Document | `/admins/attacker_uid` | Non-admin creates `/admins/attacker_uid` | `PERMISSION_DENIED` |
| 4 | Self-Assigned Admin License | `/licenses/uyenlp1310` | Student creates license with `isAdminAccount: true` | `PERMISSION_DENIED` |
| 5 | Grade Mismatch Spoofing | `/licenses/l4_00001` | Student creates `l4_00001` with `grade: 9` | `PERMISSION_DENIED` |
| 6 | Expiration Forgery (10 Years) | `/licenses/l4_00002` | Student sets `expiresAt` = now + 3650 days | `PERMISSION_DENIED` |
| 7 | Client Timestamp Spoofing | `/licenses/l4_00003` | Student sets `activatedAt` to backdated client timestamp | `PERMISSION_DENIED` |
| 8 | Shadow / Ghost Field Injection | `/licenses/l4_00004` | Student includes extra field `isVip: true` on create/update | `PERMISSION_DENIED` |
| 9 | Reactivating Revoked License | `/licenses/l4_00005` | Student updates `status: "revoked"` -> `"active"` or takes over revoked doc | `PERMISSION_DENIED` |
| 10 | Extending Expiry via Takeover | `/licenses/l4_00006` | Student modifies `expiresAt` during session takeover update | `PERMISSION_DENIED` |
| 11 | Identity Spoofing on Takeover | `/licenses/l4_00007` | Student sets `ownerUid: "victim_uid"` != `request.auth.uid` | `PERMISSION_DENIED` |
| 12 | Collection Scraping & ID Poisoning | `/licenses` (list) & `/licenses/{200-char-id}` | Student lists all licenses or creates 200-char poisoned ID | `PERMISSION_DENIED` |

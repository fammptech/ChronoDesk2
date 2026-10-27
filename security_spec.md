# Security Specification — ChronoDesk (Sistema de Gestão de Chamados)

## 1. Data Invariants

1. **Authentication & Email Verification Invariant**: Every read and write operation requires an authenticated user with `request.auth != null && request.auth.token.email_verified == true`.
2. **Ownership Isolation Invariant**: Every document across `/companies`, `/teamMembers`, `/tickets`, `/sessions`, `/auditLogs`, and `/reports` belongs to a single `ownerId` (`request.auth.uid`). Users may only `get`, `list`, `create`, `update`, or `delete` documents where `ownerId == request.auth.uid`.
3. **Relational Integrity Invariant (Master Gate / Global Consistency)**:
   - A `Ticket` (`/tickets/{ticketId}`) cannot be created unless its referenced `companyId` exists at `/companies/$(incoming().companyId)` and is owned by `request.auth.uid`.
   - An `AttendanceSession` (`/sessions/{sessionId}`) cannot be created unless its referenced `ticketId` exists at `/tickets/$(incoming().ticketId)` and is owned by `request.auth.uid`.
4. **Strict Blueprint & Anti-Shadow-Update Invariant**: Every `create` and `update` must pass `isValid[Entity](incoming())`, enforcing exact `hasAll` and `hasOnly` key allowlists, string length bounds (`minLength`..`maxLength`), regex patterns (`^[a-zA-Z0-9_\-]+$`), numeric bounds, and enum values.
5. **Action-Based Partial Updates & Terminal State Locking**:
   - Once a `Ticket` reaches `status == 'encerrado'`, further state/timer updates are blocked unless explicitly reopened via the `ReopenTicket` action.
   - Once an `AttendanceSession` reaches `sessionStatus == 'finalizada'`, no further updates are permitted.
   - `AuditLog` and `ReportRecord` documents are strictly append-only (`allow update: if false;`).
6. **Temporal Integrity & Immortal Fields**: `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`. `updatedAt` must equal `request.time` on both `create` and `update`. `ownerId` is immutable after creation.

---

## 2. The "Dirty Dozen" Payloads

1. **Unverified Email Spoof (`companies`)**: Authenticated user with `email_verified: false` attempts to create a `Company`.
2. **Cross-Tenant Ownership Spoof (`companies`)**: User `user_A` sends `ownerId: "user_B"` when creating `/companies/comp_1`.
3. **Shadow Field Injection (`tickets`)**: User includes an undeclared field `"isAdminOverride": true` during `Ticket` creation or update.
4. **Orphaned Ticket Creation (`tickets`)**: User creates a `Ticket` referencing `companyId: "non_existent_company"`.
5. **Cross-Tenant Relational Hijack (`sessions`)**: User `user_A` creates an `AttendanceSession` pointing to a `ticketId` owned by `user_B`.
6. **Denial-of-Wallet Oversized ID (`companies`)**: User sends a 500-character or special-character document ID `/companies/bad$id!@#`.
7. **Oversized String Payload (`tickets`)**: User sends a `title` of 5,000 characters (exceeding `maxLength: 240`).
8. **Invalid Enum State (`tickets`)**: User sets `status: "hacked_state"` outside `["aberto", "em_atendimento", "pausado", "encerrado"]`.
9. **Terminal State Mutation (`sessions`)**: User attempts to modify `durationSeconds` on an `AttendanceSession` whose `sessionStatus` is already `"finalizada"`.
10. **Immortal Field Tampering (`companies`)**: User attempts to mutate `createdAt` or `ownerId` during a company update.
11. **Forged Client Timestamp (`auditLogs`)**: User supplies a past or future `createdAt` timestamp instead of `request.time`.
12. **Immutable Audit Log Tampering (`auditLogs`)**: User attempts to `update` or alter an existing `/auditLogs/{logId}` document.

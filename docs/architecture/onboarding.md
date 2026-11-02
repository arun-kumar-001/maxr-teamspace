# Employee Onboarding & Activation Gate

Issue #24 ([D1-07] Onboarding Workflow, D-20). Manages the sequential 4-step checklist required for new hires before an employee account can be activated for system access.

## 1. State Machine & 4-Step Checklist

An onboarding workflow progresses strictly through 4 milestones:

1. **HR Setup (`hr`)**: Initial identity and background checks.
   - `id_proof`: Government ID proof document verified.
   - `address_proof`: Residential address verification.
   - `education_certs`: Degree / diploma certificates verified.
   - `previous_exp`: Previous employment relief letter & experience documents.
   - `emergency_contacts`: Verified emergency contact details.
   - `offer_accepted`: Signed offer acceptance letter on record.

2. **System Access (`system`)**: Account creation and baseline access.
   - `email_provisioned`: Corporate email mailbox provisioned.
   - `role_assigned`: Initial role and permissions configured.
   - `password_set`: User sets initial account password via claim token.

3. **IT / Admin (`it_admin`)**: Hardware, assets, and workspace provisioning.
   - `hardware_assigned`: Laptop / workstation allocated.
   - `access_card`: Security badge / facility access card issued.
   - `desk_assigned`: Physical or remote workspace configuration.

4. **Employee Setup (`employee`)**: Candidate policy acceptance and profile setup.
   - `profile_completed`: Personal details confirmed by the employee.
   - `policy_acknowledged`: Code of conduct, IT security, and HR policy acknowledged.

### Milestone Progression Rules

- A step can only be worked on when all items in preceding steps are verified.
- Steps cannot be skipped.
- Items are verified individually (`POST /api/v1/onboarding/:id/items/:itemKey/verify`).
- `password_set` is automatically verified when the employee successfully sets their password using their single-use token.

---

## 2. The Activation Gate

An employee cannot log in (`users.is_active = false`, `employees.status = 'pending'`) until the activation gate is executed.

- **Endpoint**: `POST /api/v1/onboarding/:id/activate`
- **Permission**: `onboarding.activate` (Admin, HR Manager)
- **Gate Check**: Every single checklist item must be `is_verified = true`. If any item is missing, the endpoint rejects the request with **422 Unprocessable Entity** and returns the array of unverified item keys.
- **Atomic Transition**: Executed in a single database transaction:
  1. `employees.status = 'active'`
  2. `users.is_active = true`
  3. `onboarding_checklists.status = 'completed'`, `current_step = 'completed'`, `completed_at = NOW()`
  4. Audit entry `onboarding.activate` written.
  5. `onboarding.activated` domain event emitted.

---

## 3. Set-Password Token Claim Link

- **Link Generation**: `POST /api/v1/onboarding/:id/generate-token`, permission `onboarding.verify_hr`.
- **Token Security**:
  - Cryptographically secure random 32-byte hex token.
  - Stored in `set_password_tokens` table hashed using SHA-256 (`token_hash`).
  - Single-use (`used_at` timestamp recorded upon claim).
  - Strict 72-hour expiration window (`expires_at`).
  - Any prior unused tokens for the user are invalidated upon generating a new token.
- **Claim Endpoint**: `POST /api/v1/onboarding/set-password` (Public route, rate-limited).
  - Body: `{ token: string, newPassword: string }`.
  - Password complexity enforced: minimum 12 characters, maximum 128 characters.
  - Hashes new password with Argon2id.
  - Sets `users.password_hash`.
  - Automatically marks `password_set` checklist item as verified.
  - Audits `onboarding.set_password` with client IP address.

---

## 4. Reopening Onboarding

If an employee's verification details require correction after activation:

- `POST /api/v1/onboarding/:id/reopen` (or unverified item via `POST /api/v1/onboarding/:id/items/:itemKey/unverify`).
- Permission: `onboarding.reopen` (Admin, HR Manager).
- Revokes active sessions via `sessionRevoker.revokeAllForUser(userId)`.
- Reverts `users.is_active = false` and `employees.status = 'pending'`.
- Sets checklist status back to `in_progress`.
- Audited with mandatory or optional reopen reason.

---

## 5. API Summary

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/v1/onboarding` | `onboarding.list` | List scoped checklists with pagination, status, and department filters |
| `GET` | `/api/v1/onboarding/me` | `onboarding.read_own` | Get own onboarding checklist for currently authenticated employee |
| `GET` | `/api/v1/onboarding/:id` | `onboarding.read` | Get single employee onboarding checklist and items |
| `POST` | `/api/v1/onboarding/:id/items/:itemKey/verify` | `onboarding.verify_hr` | Verify a checklist item (role-checked against item step) |
| `POST` | `/api/v1/onboarding/:id/items/:itemKey/unverify` | `onboarding.reopen` | Unverify a checklist item |
| `POST` | `/api/v1/onboarding/:id/generate-token` | `onboarding.verify_hr` | Generate a 72-hour hashed set-password claim link |
| `POST` | `/api/v1/onboarding/set-password` | Public | Set account password using claim token |
| `POST` | `/api/v1/onboarding/:id/employee-step` | `onboarding.complete_employee` | Complete own employee step items |
| `POST` | `/api/v1/onboarding/:id/activate` | `onboarding.activate` | The Activation Gate: activate account once all items verified |
| `POST` | `/api/v1/onboarding/:id/reopen` | `onboarding.reopen` | Reopen onboarding checklist and revoke active access |


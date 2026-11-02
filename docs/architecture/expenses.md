# Expense claims (#29, D-17)

Backend for expense claims: categories, claims with receipts, the two-step approval and reimbursement.
The UI (new claim with camera receipt capture, the review inbox) is Dev 2's and is not part of this page.

## States

```
draft ──submit──▶ submitted ──manager + HR approve──▶ approved ──reimburse (HR)──▶ reimbursed
  │                  │
  └──cancel──▶ cancelled ◀──cancel── (claimant)      submitted ──reject (any step)──▶ rejected
```

- `draft` is an addition to D-17, which lists `submitted` as the first state. A claim is created as a draft so its receipt can be attached before it is routed, and the receipt rule (above 200.00 INR) is checked at submission.
- `submitted → approved | rejected` happens only through the approvals engine (`expense_claim` subject). The final decision calls `ExpensesService.apply` inside the decision transaction.
- `approved → reimbursed` is HR's action (`expenses.reimburse`). Nobody reimburses their own claim.
- `rejected`, `cancelled` and `reimbursed` are final. Transitions are the table in `expenses.rules.ts`; anything else is a 409.

## Rules

| Rule | Where |
| --- | --- |
| Amount is integer paise, 1 to 10,000,000 (100,000.00 INR); currency is INR | `expenses.schemas.ts`, migration CHECKs |
| Expense date is not in the future and not older than 60 days (company today) | `assertClaimDate`, checked at create and at submit |
| Receipt required above 200.00 INR (20,000 paise), checked at submit | `assertReceiptRule` |
| Receipt: PDF, PNG or JPEG up to 5 MB, checked by content and scanned | storage category `receipts` |
| Receipt attachable only while the claim is a draft, by the claimant | service and `attachReceipt` SQL guard |
| Two steps: the requester's manager, then HR. Team Leads, HR and Admin go to HR only | `defaultRoute(..., twoStep)` in the approvals engine |
| Nobody approves their own claim | approvals engine (`own_request`) |
| Categories are HR-managed; deactivating one stops new claims, old claims keep it | `expense_categories.is_active` |

## Access

| Route | Permission | Scope |
| --- | --- | --- |
| `POST /expense-claims`, `…/submit`, `…/cancel`, `…/receipt` | `expenses.submit` | own claim only (others: 404) |
| `GET /expense-claims/me` | `expenses.read_own` | own |
| `GET /expense-claims/{id}` | `expenses.read_own` | own, or inside the reviewer's scope |
| `GET /expense-claims` | `expenses.list` | Team Lead: team; HR and Admin: all |
| `GET /expense-claims/{id}/receipt/download-link` | `expenses.read_own` | claimant, or a reviewer in scope; otherwise 404 |
| `POST /expense-claims/{id}/reimburse` | `expenses.reimburse` | HR Manager and Admin, not own claims |
| `GET /expense-categories` | `expenses.read_own` | everyone (active only) |
| `POST /expense-categories`, `…/{id}/deactivate` | `expenses.manage_categories` | HR Manager and Admin |

A claim outside the caller's scope is a 404, the same as a missing one. Receipts are read through short-lived signed links (`platform/storage`), and the stored key never appears in an API response.

## Data

- `expense_categories`: seeded with Travel, Meals, Accommodation, Office supplies, Client entertainment, Other.
- `expense_claims`: one row per claim; receipt metadata and the storage key are on the row. Indexes: employee and created time (FK and "my claims"), category (FK), status and created time (review and reimbursement queues).
- Approvals: one `approvals` row per submitted claim (`subject_type = 'expense_claim'`); notifications for approval requests and decisions come from the existing approval events.
- Audit: `expense.create`, `expense.receipt_attach`, `expense.submit`, `expense.cancel`, `expense.approve`, `expense.reject`, `expense.reimburse`, `expense.category_create`, `expense.category_deactivate`. Descriptions and file names are not written to the trail.

## Concurrency

A cancel locks the approval before the claim, the same order as a decision, so the two cannot deadlock. Status changes take a row lock on the claim (`FOR UPDATE`). The receipt write is guarded by `status = 'draft'` in the same statement.

## Not in this change

- The receipt virus-scan adapter is the storage service's hook; this module adds no scanner of its own.
- The company currency is fixed to INR in the schema. A setting for it is not needed until a second currency is decided.

# Approvals engine

Issue #37 (backend; the inbox UI is Dev 2's). One engine decides requests for every module: leave (#40), attendance corrections (#36) and later expense claims (#29). Rules: D-12 (routing, no self-approval) and D-17 (two steps for expenses).

## Model

An approval belongs to one subject (`subject_type` + `subject_id`, unique) and has a **route**: an ordered list of stages, fixed when it is opened.

| Stage     | Who decides it                                                                 |
| --------- | ------------------------------------------------------------------------------ |
| `manager` | The requester's manager (`employees.manager_id`) only                          |
| `hr`      | An HR Manager or an Admin (the catalog grants Admin `approvals.decide`)         |

Status: `pending → approved | rejected | cancelled`. The three end states are final (`APPROVAL_TRANSITIONS`). Each decision is a row in `approval_decisions` (one per stage, with the decider and an optional comment of up to 500 characters).

## API

| Route                            | Permission         | Notes                                                                                                           |
| -------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `GET /approvals`                 | `approvals.list`   | Scope: Admin and HR all, Team Lead direct reports, Staff their own. Oldest first. `status`, `subjectType`, `awaitingMyDecision=true` (what waits for you) |
| `GET /approvals/{id}`            | `approvals.read`   | 404 outside the scope, identical to a missing id                                                                |
| `POST /approvals/{id}/approve`   | `approvals.decide` | Body `{ comment? }`. Approving a middle stage moves to the next; the last stage applies the decision            |
| `POST /approvals/{id}/reject`    | `approvals.decide` | Body `{ comment }` (required). Ends the request at any stage                                                    |

There is **no route that creates an approval**. Only the module that owns a subject opens one, in the transaction that stores the subject, so either both exist or neither does. (`approvals.create` stays in the catalog for now and no route uses it.)

Refusals: 404 outside the scope; 403 for your own request (even with company-wide scope), for a stage that is not yours, and for a second stage of a route you already decided (four eyes); 409 when the request was already decided the other way or cancelled; 400 for an invalid body (a rejection without a comment). Repeating the decision that already stands is a 200 with no change, no second handler call and no second audit entry.

## What a decision does

One database transaction, under a row lock on the approval (`SELECT … FOR UPDATE`), so two people deciding at the same moment run one after the other:

1. check scope, own request, status and stage;
2. record the decision and move the approval on;
3. write the audit entry (`approvals.approve` / `approvals.reject`, with the status change and whether a comment was given, never the comment text) in the same transaction;
4. last, at the end of the route (or on a rejection), call the module's **handler** with the open transaction, so a module failure also undoes the decision and its audit entry.

If any of these fails, nothing is kept: the approval stays pending and the module's own writes are undone. Events (`approvals.requested`, `approvals.advanced`, `approvals.approved`, `approvals.rejected`, carrying ids only) are sent after the commit. A refused attempt is audited with outcome `denied` (403) or `failure`.

## For a module (leave, correction, expense)

```ts
// composition root, once
approvals.service.registerHandler({
  subjectType: 'leave_request',
  async apply(tx, approval, outcome, decider) {
    // runs inside the decision transaction: update the request state and the balance with `tx`
  },
});

// when the subject is created, in the same transaction
const stages = await approvals.service.route(tx, employeeId, { twoStep: false });
await approvals.service.submit(tx, { subjectType: 'leave_request', subjectId, requesterEmployeeId: employeeId, stages }, events);

// when the requester cancels the subject
await approvals.service.cancel(tx, 'leave_request', subjectId);
```

`route` follows D-12 and D-17: the requester's manager when there is one, then HR when `twoStep`. A Team Lead, HR Manager or Admin, and anyone without a manager, goes to HR only. Throwing from `apply` rolls the whole decision back. Submitting a subject type with no registered handler is a programming error and throws.

## Not covered here

The leave and correction state machines and balances (#38 to #40, #36), expense claims (#29), notification templates and the reminder for approvals pending over 24 hours (#41), and an HR override of a missing manager (a deactivated manager leaves a `manager` stage undecidable until HR re-routes it; not implemented).

Migration `20261030000012_approvals.sql` creates `approvals` and `approval_decisions` with the route, status and decision-time rules as CHECK constraints.

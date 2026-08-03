# Activity registration plan

Updated: 2026-08-03

## Implemented foundation

- Registrations are per `child_id`; active duplicates are rejected in the API and database.
- `registered` and `waitlisted` are active; `cancelled` permits a later registration with a new idempotency key.
- A multi-child request runs in one database transaction. Capacity decisions are serialized per activity and count only `registered` rows.
- Replaying the same child and idempotency key returns the existing result. Reusing a key for another child or activity is rejected.
- Capacity presentation remains `registeredCount`, `availablePlaces`, and `maxParticipants`; waitlisted children do not consume capacity.
- Activity contact policy and explicit mentor approvals are represented in the database with service-role-only grants and RLS enabled.
- The mentor details endpoint verifies activity ownership before returning private registration data. Child display uses a regular period after the family initial.

## Required wiring after sandbox access is restored

- Add `contactPhoneVisibility` to activity validation, persistence, create/edit forms and preview.
- Return the authenticated parent's per-child active registration states from the parent activities API.
- Disable registered and waitlisted children in activity cards and the child picker, while leaving unregistered siblings selectable.
- Refresh cards, capacity, registration state and cancellation state immediately after mutations.
- Expand the parent activity modal and "My activities" grouping with all sessions, operational details, child statuses, mentor photo rules and server-filtered phone access.
- Add the owner-only registrations view to the mentor activity manager and connect explicit contact approvals.

## Deferred product packages

- Full mentor registration management.
- Waitlist notification and automatic promotion workflow.
- Feedback and feedback privacy.
- Requests/referrals page restructuring and mentor-card behavior.

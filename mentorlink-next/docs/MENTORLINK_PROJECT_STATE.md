# MentorLink project state

Updated: 2026-08-04

## Current branch

- Feature: `feature/activity-registration-final`
- Foundation: remote `feature/activity-registration-management` at `679da5d`.
- Migration 031 was already applied remotely before this package and remains unchanged.

## Product rules now represented

- Creating an account does not publish a mentor; minor mentors still require parent consent and administrator review.
- Parent and child details are not public. A mentor receives the relevant family details only after that parent contacts the mentor or registers a child in the mentor's activity.
- A street may be stored for ordinary matching. House, entrance, apartment and arrival notes are requested only when the parent chooses home mentoring.
- Activity registration is child-specific, capacity-safe and replay-safe. Completed registrations cannot be cancelled.
- Mentor phone exposure is controlled per activity. Parent phone is required for contact and activity registration.
- Feedback is attached to one completed registration. Professional feedback is visible to the mentor; safety details are administrator-only; public quotation requires parent consent and administrator approval.

## Verification expectations

- Run the focused registration and feedback tests.
- Run `git diff --check`.
- Run a full Next.js build with the project's real environment variables. Dummy Supabase values prove compilation and TypeScript but cannot complete data-backed static prerendering.
- Dry-run migration 032, then apply it once and verify local/remote migration alignment.

## Deferred package

- “המשפחות בקהילה שלי”: a dedicated mentor directory of linked families, conversation history and follow-up messages.
- Automatic waitlist promotion notifications.
- Publishing administrator-approved feedback summaries on mentor profiles.

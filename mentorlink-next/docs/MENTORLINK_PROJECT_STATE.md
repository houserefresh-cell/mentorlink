# MentorLink project state

Updated: 2026-08-03

## Existing systems

- Next.js 16 application with Supabase authentication and server-only service-role access.
- Mentor activity lifecycle: draft, published, cancelled and completed, including sessions, capacity, accessibility, pickup, operational updates and images.
- Parent children and subject preferences are private service-owned records.
- Activity registration is per child and supports registered, waitlisted and cancelled states.
- Minor mentor onboarding uses explicit parent consent. Public profile photos require separate consent.

## Privacy decisions

- A child registration is owned by the authenticated parent and validated again in the database.
- Public responses must not include child needs, full surname, birth date, school or private identifiers.
- A mentor may see registration details only for an activity they own. Parent phone is available for registered entries only; waitlisted entries do not expose it.
- Mentor phone visibility is activity-specific: `public`, `registered_parents` or `mentor_approved`. Existing activities default to `registered_parents`.
- Per-parent contact approval is stored separately and can only be changed by the activity owner for a parent with a registered child.

## Current package

- Added migration `202608030031_complete_activity_registration_privacy.sql`.
- Added replay-safe registration idempotency while preserving transaction-level capacity locking and atomic multi-child requests.
- Added the private mentor registration-details API and focused privacy tests.
- Existing files could not be patched because the workspace sandbox failed while applying read ACLs. The existing UI and activity save pipeline therefore still need the new contact policy wired through.

## Later packages

- Full mentor registration-management interface.
- Waitlist notifications and automatic promotion.
- Feedback system and feedback privacy.
- Requests and referrals page reorganization and mentor-card opening fix.

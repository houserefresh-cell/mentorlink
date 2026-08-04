# Activity registration and feedback plan

Updated: 2026-08-04

## Implemented

- Registration is per child, duplicate active registrations are rejected, and multi-child capacity decisions remain atomic.
- Registered and waitlisted children are disabled in the child picker immediately after registration.
- Parent activity cards show capacity, status, full activity details and mentor call/WhatsApp actions whenever the server grants access to the phone number.
- Completed activities are separated from upcoming activities, cannot be cancelled, and link to the feedback task.
- Mentors can open an owner-only registration view with the linked parent's profile, phone, email, address fields, child details and interests.
- Activity owners choose one of three phone visibility policies: public, registered parents, or explicit mentor approval.
- Parent profiles now include a required phone number and optional address. A full address is stored only when home mentoring is requested.
- A parent must complete the phone profile before registering, sending an inquiry or requesting a meeting.
- The feedback flow uses explicit Hebrew five-point labels, professional comments, separate private safety questions and optional publication consent.
- Parents see pending feedback tasks with a calm violet counter. Mentors receive only the professional portion. Administrators receive the complete moderation and safety record.

## Database changes

- Migration `202608030031_complete_activity_registration_privacy.sql` is the applied registration/privacy foundation and must not be edited.
- Migration `202608040032_add_parent_profiles_and_activity_feedback.sql` adds parent profiles, child surnames and activity feedback.

## Deliberately deferred

- A dedicated mentor “community families” contact directory and free-form follow-up messaging.
- Automatic waitlist promotion messages across every notification channel.
- Public profile aggregation of approved feedback; the current package stores moderation decisions but does not publish quotes yet.
- Broader requests/referrals page restructuring.

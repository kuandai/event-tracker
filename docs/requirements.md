# Requirements

## Product Goals
- Maintain a centralized list of organization activities with due dates.
- Allow anonymous viewing without an account.
- Provide optional accounts so members can mark items as completed.
- Keep admin workflow lightweight: add/update/remove events quickly.

## Users
- Admin: maintains the official list of events.
- Member: optional account for personal completion tracking.
- Guest: views events without logging in.

## Core User Stories
- As a guest, I can see all upcoming events and due dates.
- As a member, I can register and log in to track completion.
- As a member, I can mark items as done and undo if needed.
- As an admin, I can add, edit, and delete events.

## Non-Goals (for v0)
- Email or push notifications.
- Complex role management (multiple admins, approval flows).
- Calendar integrations.
- Mobile app builds.

## Quality Notes
- Clear data ownership: admin owns official list; members own personal status.
- Easy to extend storage and auth without rewriting UI.

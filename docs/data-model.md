# Data Model (Draft)

## Event
- `id` (string)
- `title` (string)
- `type` (enum: Homework | Quiz | Assignment | Other)
- `dueDate` (date, ISO 8601)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

## User
- `id` (string)
- `username` (string)
- `passwordHash` (string)
- `createdAt` (timestamp)

## Completion
- `id` (string)
- `userId` (string)
- `eventId` (string)
- `completedAt` (timestamp)

## Permissions
- Guests: read-only access to events.
- Members: read access + create/update their own completion records.
- Admins: CRUD events + view aggregated completion metrics.

# API Contract (v0)

## Conventions
- Base URL: `/api`
- Auth header (member routes): `Authorization: Bearer <token>`
- Content type: `application/json`
- Dates: ISO `YYYY-MM-DD`
- Pagination: `limit` + `cursor` (opaque string from previous response)

## Event Shapes

### `Event`
```json
{
  "id": "evt_001",
  "title": "Week 2 Homework",
  "type": "homework",
  "dueDate": "2026-02-18"
}
```

### `EventWithUserState`
```json
{
  "id": "evt_001",
  "title": "Week 2 Homework",
  "type": "homework",
  "dueDate": "2026-02-18",
  "isCompleted": false,
  "completedAt": null
}
```

## Public Routes (Anonymous Allowed)

### `GET /events`
List organization events for guests and logged-in users (no user-specific completion data).

Query params:
- `scope=upcoming|past|all` (default: `upcoming`)
- `from=YYYY-MM-DD` (optional)
- `to=YYYY-MM-DD` (optional)
- `type=<value>` (optional, repeatable)
- `limit=1..100` (default: `25`)
- `cursor=<opaque>` (optional)

Response:
```json
{
  "items": [
    {
      "id": "evt_001",
      "title": "Week 2 Homework",
      "type": "homework",
      "dueDate": "2026-02-18"
    }
  ],
  "nextCursor": "eyJkdWVEYXRlIjoiMjAyNi0wMi0xOCIsImlkIjoiZXZ0XzAwMSJ9",
  "meta": {
    "scope": "upcoming",
    "limit": 25
  }
}
```

## Auth Routes

### `POST /auth/register`
Body:
```json
{ "username": "alice", "password": "password123" }
```
Response: `201 Created`
```json
{ "ok": true }
```

### `POST /auth/login`
Body:
```json
{ "username": "alice", "password": "password123" }
```
Response:
```json
{ "token": "<token>", "username": "alice" }
```

### `POST /auth/logout`
Response:
```json
{ "ok": true }
```

## Member Routes (Auth Required)

### `GET /me`
Response:
```json
{ "username": "alice", "completed": ["evt_001"] }
```

### `GET /me/events`
List events with member completion state.

Query params:
- `status=todo|done|all` (default: `todo`)
- `scope=upcoming|past|all` (default: `upcoming`)
- `type=<value>` (optional, repeatable)
- `limit=1..100` (default: `25`)
- `cursor=<opaque>` (optional)

Response:
```json
{
  "items": [
    {
      "id": "evt_002",
      "title": "Quiz 1",
      "type": "quiz",
      "dueDate": "2026-02-20",
      "isCompleted": false,
      "completedAt": null
    }
  ],
  "nextCursor": null,
  "meta": {
    "status": "todo",
    "scope": "upcoming",
    "limit": 25
  }
}
```

### `POST /me/toggle`
Body:
```json
{ "eventId": "evt_001" }
```
Response:
```json
{ "completed": ["evt_001", "evt_003"] }
```

## Admin Routes

Admin auth (v0): header `x-admin-key: <key>`

### `POST /admin/events`
Body:
```json
{ "title": "Project Proposal", "type": "assignment", "dueDate": "2026-02-25" }
```
Response: `201 Created`
```json
{
  "event": {
    "id": "evt_abc123",
    "title": "Project Proposal",
    "type": "assignment",
    "dueDate": "2026-02-25"
  }
}
```

### `PATCH /admin/events/:id`
Body:
```json
{ "title": "Updated title", "type": "quiz", "dueDate": "2026-02-28" }
```
Response:
```json
{ "event": { "id": "evt_abc123", "title": "Updated title", "type": "quiz", "dueDate": "2026-02-28" } }
```

### `DELETE /admin/events/:id`
Response:
```json
{ "removed": { "id": "evt_abc123", "title": "Updated title", "type": "quiz", "dueDate": "2026-02-28" } }
```

## Error Shape
All non-2xx responses use:
```json
{ "error": "Human-readable message." }
```

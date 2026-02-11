# API Sketch

## Public
- `GET /api/events`
  - Response: `{ events: Event[] }`

## Auth
- `POST /api/auth/register`
  - Body: `{ username, password }`
- `POST /api/auth/login`
  - Body: `{ username, password }`
  - Response: `{ token, username }`
- `POST /api/auth/logout`

## Member
- `GET /api/me`
  - Response: `{ username, completed: string[] }`
- `POST /api/me/toggle`
  - Body: `{ eventId }`
  - Response: `{ completed: string[] }`

## Admin
- `POST /api/admin/events`
  - Header: `x-admin-key`
  - Body: `{ title, type, dueDate }`
- `PATCH /api/admin/events/:id`
  - Header: `x-admin-key`
  - Body: `{ title?, type?, dueDate? }`
- `DELETE /api/admin/events/:id`
  - Header: `x-admin-key`

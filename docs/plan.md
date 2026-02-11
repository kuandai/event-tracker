# Implementation Plan (Near Term)

## Backend
- Move data into a real database with migrations.
- Add validation layer and structured error responses.
- Create admin-only analytics endpoint.

## Frontend
- Add event filters (by type, due date).
- Display a completion percentage per user.
- Improve forms with inline validation.

## Operations
- Add `.env` handling and config docs.
- Add smoke tests for core endpoints.
- Define deployment target (Render, Fly.io, etc.).

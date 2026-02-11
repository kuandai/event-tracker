# Implementation Plan (Near Term)

## UI Architecture Rule
- Keep **frame UI** and **page UI** separated.
- Frame UI owns app shell concerns only:
  - Sidebar, top bar, global spacing, and shell-level responsive behavior.
- Page UI owns event-tracker concerns only:
  - Filters, list rendering, empty/loading/error states, and member actions.
- Do not place page-specific styles or business logic in shell components.

## Event Tracker View Checklist

### Phase 1: Structure and Read-Only Data
- [x] Create `EventTrackerView` container inside page content area.
- [x] Keep shell layout untouched while swapping page body content.
- [x] Add `EventFilters` with `scope` and `type` controls.
- [x] Add `EventList` + `EventCard` for anonymous event rendering.
- [x] Wire `GET /api/events` for anonymous/default mode.
- [x] Add cursor-based `Load more` pagination.
- [x] Implement page states: loading, empty, error.

### Phase 2: Member State
- [ ] Detect session/token presence in client state.
- [ ] Switch data source to `GET /api/me/events` when authenticated.
- [ ] Add `status` filter (`todo|done|all`) for authenticated users.
- [ ] Add completion toggle action via `POST /api/me/toggle`.
- [ ] Implement optimistic toggle update with rollback on failure.

### Phase 3: UX and Quality
- [ ] Persist current filter state in URL query params.
- [ ] Add basic accessibility pass (labels, keyboard navigation, focus states).
- [ ] Add smoke tests for event list filtering and pagination behavior.
- [ ] Add smoke tests for member toggle and status filtering behavior.

## Follow-up Tracks

### Backend
- [ ] Move data into a real database with migrations.
- [ ] Add validation layer and structured error responses.
- [ ] Create admin-only analytics endpoint.

### Operations
- [ ] Add `.env` handling and config docs.
- [ ] Define deployment target (Render, Fly.io, etc.).

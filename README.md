# Centralized Activity Tracker

Lightweight scaffold for an organization event tracker. Public viewing is anonymous; accounts are optional for tracking completion.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Admin key

Admin endpoints require `x-admin-key`. Default is `dev-admin-key`.

```bash
ADMIN_KEY=your-secret-key npm run dev
```

## Notes
- Data is stored in SQLite at `data/event-tracker.db` by default.
- You can override DB location with `DB_FILE=/path/to/file.db`.
- Passwords use a placeholder SHA-256 hash. Replace with bcrypt before production.
- Username matching is case-insensitive for login, while display casing is preserved.

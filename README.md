# Centralized Activity Tracker

Lightweight scaffold for an organization event tracker. Public viewing is anonymous; accounts are optional for tracking completion.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Admin access

Admin endpoints use account roles (`admin` or `user`) and require normal bearer auth.

- If there are no admins yet, the next registered account is assigned `admin`.
- Once an admin exists, new registrations are assigned `user`.

## Notes
- Data is stored in SQLite at `data/event-tracker.db` by default.
- You can override DB location with `DB_FILE=/path/to/file.db`.
- Passwords use a placeholder SHA-256 hash. Replace with bcrypt before production.
- Username matching is case-insensitive for login, while display casing is preserved.
- Existing databases are migrated to include a `role` column automatically.
- If a migrated database has users but no admins, the oldest user is promoted to `admin`.

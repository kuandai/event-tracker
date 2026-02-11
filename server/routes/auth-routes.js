import {
  getCompletedIds
} from "../lib/event-query.js";
import {
  asyncRoute,
  createToken,
  hashPassword,
  normalizeRole,
  normalizeUsername,
  nowIso
} from "../lib/helpers.js";

export function registerAuthRoutes(app, { dbAll, dbGet, dbRun, requireUser }) {
  app.post(
    "/api/auth/register",
    asyncRoute(async (req, res) => {
      const usernameDisplay = String(req.body?.username || "").trim();
      const usernameNormalized = normalizeUsername(usernameDisplay);
      const password = String(req.body?.password || "");

      if (!usernameDisplay || password.length < 6) {
        return res.status(400).json({ error: "Username and 6+ character password required." });
      }

      const adminCountRow = await dbGet("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      const role = Number(adminCountRow?.count || 0) === 0 ? "admin" : "user";

      try {
        await dbRun(
          `
            INSERT INTO users (username_display, username_normalized, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?)
          `,
          [usernameDisplay, usernameNormalized, hashPassword(password), role, nowIso()]
        );
      } catch (error) {
        if (error.code === "SQLITE_CONSTRAINT") {
          return res.status(409).json({ error: "User already exists." });
        }
        throw error;
      }

      return res.status(201).json({ ok: true, role });
    })
  );

  app.post(
    "/api/auth/login",
    asyncRoute(async (req, res) => {
      const usernameInput = String(req.body?.username || "").trim();
      const usernameNormalized = normalizeUsername(usernameInput);
      const password = String(req.body?.password || "");

      const user = await dbGet(
        `
          SELECT id, username_display AS usernameDisplay, password_hash AS passwordHash, role
          FROM users
          WHERE username_normalized = ?
        `,
        [usernameNormalized]
      );

      if (!user || user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ error: "Invalid credentials." });
      }

      const token = createToken();
      await dbRun("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)", [
        token,
        user.id,
        nowIso()
      ]);

      return res.json({ token, username: user.usernameDisplay, role: normalizeRole(user.role) });
    })
  );

  app.post(
    "/api/auth/logout",
    requireUser,
    asyncRoute(async (req, res) => {
      await dbRun("DELETE FROM sessions WHERE token = ?", [req.user.token]);
      return res.json({ ok: true });
    })
  );

  app.get(
    "/api/me",
    requireUser,
    asyncRoute(async (req, res) => {
      const completed = await getCompletedIds(dbAll, req.user.userId);
      return res.json({ username: req.user.usernameDisplay, role: req.user.role, completed });
    })
  );
}

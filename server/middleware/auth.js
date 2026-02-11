import { normalizeRole } from "../lib/helpers.js";

function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

export async function getSessionForToken(dbGet, token) {
  if (!token) {
    return null;
  }

  const row = await dbGet(
    `
      SELECT
        s.token AS token,
        u.id AS userId,
        u.username_display AS usernameDisplay,
        u.username_normalized AS usernameNormalized,
        u.role AS role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `,
    [token]
  );

  if (!row) {
    return null;
  }

  return {
    token: row.token,
    userId: row.userId,
    usernameDisplay: row.usernameDisplay,
    usernameNormalized: row.usernameNormalized,
    role: normalizeRole(row.role)
  };
}

export function createRequireUser(dbGet) {
  return async (req, res, next) => {
    try {
      const token = readBearerToken(req);
      const session = await getSessionForToken(dbGet, token);
      if (!session) {
        return res.status(401).json({ error: "Authentication required." });
      }

      req.user = session;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  return next();
}

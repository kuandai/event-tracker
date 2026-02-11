import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { all as dbAll, get as dbGet, initDatabase, run as dbRun } from "./db.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const DB_FILE = process.env.DB_FILE ?? path.join(__dirname, "..", "data", "event-tracker.db");

app.use(express.json());
app.use(express.static(publicDir));

const VALID_SCOPE = new Set(["upcoming", "past", "all"]);
const VALID_STATUS = new Set(["todo", "done", "all"]);
const VALID_USER_ROLE = new Set(["admin", "user"]);

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEventType(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return VALID_USER_ROLE.has(role) ? role : "user";
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function localTodayIso() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nowIso() {
  return new Date().toISOString();
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function encodeCursor(item) {
  return Buffer.from(
    JSON.stringify({
      dueDate: item.dueDate,
      id: item.id
    }),
    "utf8"
  ).toString("base64");
}

function decodeCursor(rawCursor) {
  if (rawCursor === undefined) {
    return null;
  }

  const cursor = String(firstQueryValue(rawCursor) || "").trim();
  if (!cursor) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    if (!decoded || typeof decoded !== "object" || !isIsoDate(decoded.dueDate) || !decoded.id) {
      throw new Error("Malformed cursor.");
    }
    return {
      dueDate: decoded.dueDate,
      id: String(decoded.id)
    };
  } catch (error) {
    throw new Error("Invalid cursor.");
  }
}

function parseTypeFilters(rawType) {
  if (rawType === undefined) {
    return new Set();
  }

  const values = Array.isArray(rawType) ? rawType : [rawType];
  const types = values
    .flatMap((value) => String(value).split(","))
    .map((value) => normalizeEventType(value))
    .filter(Boolean);

  return new Set(types);
}

function parseLimit(rawLimit) {
  if (rawLimit === undefined) {
    return 25;
  }

  const limitValue = String(firstQueryValue(rawLimit) || "").trim();
  const limit = Number.parseInt(limitValue, 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer between 1 and 100.");
  }
  return limit;
}

function parseListQuery(query, options = {}) {
  const includeStatus = options.includeStatus === true;
  const scope = String(firstQueryValue(query.scope) || "upcoming").toLowerCase();
  if (!VALID_SCOPE.has(scope)) {
    throw new Error("scope must be one of: upcoming, past, all.");
  }

  const from = firstQueryValue(query.from);
  const to = firstQueryValue(query.to);
  const normalizedFrom = from === undefined ? undefined : String(from).trim();
  const normalizedTo = to === undefined ? undefined : String(to).trim();

  if (normalizedFrom && !isIsoDate(normalizedFrom)) {
    throw new Error("from must use YYYY-MM-DD.");
  }
  if (normalizedTo && !isIsoDate(normalizedTo)) {
    throw new Error("to must use YYYY-MM-DD.");
  }
  if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
    throw new Error("from cannot be greater than to.");
  }

  let status;
  if (includeStatus) {
    status = String(firstQueryValue(query.status) || "todo").toLowerCase();
    if (!VALID_STATUS.has(status)) {
      throw new Error("status must be one of: todo, done, all.");
    }
  }

  return {
    scope,
    from: normalizedFrom,
    to: normalizedTo,
    typeFilters: parseTypeFilters(query.type),
    limit: parseLimit(query.limit),
    cursor: decodeCursor(query.cursor),
    status
  };
}

function compareEventAsc(a, b) {
  const dueDateOrder = a.dueDate.localeCompare(b.dueDate);
  if (dueDateOrder !== 0) {
    return dueDateOrder;
  }
  return a.id.localeCompare(b.id);
}

function compareEventDesc(a, b) {
  const dueDateOrder = b.dueDate.localeCompare(a.dueDate);
  if (dueDateOrder !== 0) {
    return dueDateOrder;
  }
  return b.id.localeCompare(a.id);
}

function filterAndSortEvents(items, query) {
  const today = localTodayIso();
  let filtered = items.filter((event) => {
    if (query.scope === "upcoming" && event.dueDate < today) {
      return false;
    }
    if (query.scope === "past" && event.dueDate >= today) {
      return false;
    }
    if (query.from && event.dueDate < query.from) {
      return false;
    }
    if (query.to && event.dueDate > query.to) {
      return false;
    }
    if (query.typeFilters.size > 0 && !query.typeFilters.has(normalizeEventType(event.type))) {
      return false;
    }
    return true;
  });

  filtered = [...filtered].sort(query.scope === "past" ? compareEventDesc : compareEventAsc);
  return filtered;
}

function paginate(items, cursor, limit) {
  let startIndex = 0;

  if (cursor) {
    const cursorIndex = items.findIndex((item) => item.id === cursor.id && item.dueDate === cursor.dueDate);
    if (cursorIndex === -1) {
      throw new Error("Invalid cursor.");
    }
    startIndex = cursorIndex + 1;
  }

  const pagedItems = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;
  const nextCursor = hasMore && pagedItems.length > 0 ? encodeCursor(pagedItems[pagedItems.length - 1]) : null;

  return {
    items: pagedItems,
    nextCursor
  };
}

function mapEventRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    dueDate: row.due_date ?? row.dueDate
  };
}

function toEventResponse(event) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    dueDate: event.dueDate
  };
}

async function listEventsFromDb() {
  const rows = await dbAll("SELECT id, title, type, due_date FROM events");
  return rows.map(mapEventRow);
}

async function getCompletionMapForUser(userId) {
  const rows = await dbAll(
    "SELECT event_id AS eventId, completed_at AS completedAt FROM completions WHERE user_id = ?",
    [userId]
  );
  const completionMap = new Map();
  for (const row of rows) {
    completionMap.set(String(row.eventId), row.completedAt);
  }
  return completionMap;
}

async function getCompletedIds(userId) {
  const rows = await dbAll("SELECT event_id AS eventId FROM completions WHERE user_id = ? ORDER BY event_id", [
    userId
  ]);
  return rows.map((row) => String(row.eventId));
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  return token || null;
}

async function getSessionForToken(token) {
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

const requireUser = asyncRoute(async (req, res, next) => {
  const token = readBearerToken(req);
  const session = await getSessionForToken(token);
  if (!session) {
    return res.status(401).json({ error: "Authentication required." });
  }

  req.user = session;
  return next();
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  return next();
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get(
  "/api/events",
  asyncRoute(async (req, res) => {
    let query;
    try {
      query = parseListQuery(req.query);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const dbEvents = await listEventsFromDb();
    const filtered = filterAndSortEvents(dbEvents, query);

    let paged;
    try {
      paged = paginate(filtered, query.cursor, query.limit);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      items: paged.items.map(toEventResponse),
      nextCursor: paged.nextCursor,
      meta: {
        scope: query.scope,
        limit: query.limit
      }
    });
  })
);

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
    const completed = await getCompletedIds(req.user.userId);
    return res.json({ username: req.user.usernameDisplay, role: req.user.role, completed });
  })
);

app.get(
  "/api/me/events",
  requireUser,
  asyncRoute(async (req, res) => {
    let query;
    try {
      query = parseListQuery(req.query, { includeStatus: true });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const completionMap = await getCompletionMapForUser(req.user.userId);
    let filtered = filterAndSortEvents(await listEventsFromDb(), query);

    if (query.status === "todo") {
      filtered = filtered.filter((event) => !completionMap.has(event.id));
    } else if (query.status === "done") {
      filtered = filtered.filter((event) => completionMap.has(event.id));
    }

    let paged;
    try {
      paged = paginate(filtered, query.cursor, query.limit);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({
      items: paged.items.map((event) => ({
        ...toEventResponse(event),
        isCompleted: completionMap.has(event.id),
        completedAt: completionMap.get(event.id) ?? null
      })),
      nextCursor: paged.nextCursor,
      meta: {
        status: query.status,
        scope: query.scope,
        limit: query.limit
      }
    });
  })
);

app.post(
  "/api/me/toggle",
  requireUser,
  asyncRoute(async (req, res) => {
    const eventId = String(req.body?.eventId || "").trim();
    if (!eventId) {
      return res.status(400).json({ error: "Event required." });
    }

    const event = await dbGet("SELECT id FROM events WHERE id = ?", [eventId]);
    if (!event) {
      return res.status(404).json({ error: "Event not found." });
    }

    const existing = await dbGet(
      "SELECT completed_at AS completedAt FROM completions WHERE user_id = ? AND event_id = ?",
      [req.user.userId, eventId]
    );

    if (existing) {
      await dbRun("DELETE FROM completions WHERE user_id = ? AND event_id = ?", [req.user.userId, eventId]);
    } else {
      await dbRun("INSERT INTO completions (user_id, event_id, completed_at) VALUES (?, ?, ?)", [
        req.user.userId,
        eventId,
        nowIso()
      ]);
    }

    const completed = await getCompletedIds(req.user.userId);
    return res.json({ completed });
  })
);

app.post(
  "/api/admin/events",
  requireUser,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const title = String(req.body?.title || "").trim();
    const type = normalizeEventType(req.body?.type);
    const dueDate = String(req.body?.dueDate || "").trim();

    if (!title || !type || !isIsoDate(dueDate)) {
      return res.status(400).json({ error: "Title, type, and dueDate (YYYY-MM-DD) required." });
    }

    const event = {
      id: `evt_${crypto.randomBytes(4).toString("hex")}`,
      title,
      type,
      dueDate
    };

    const timestamp = nowIso();
    await dbRun(
      `
        INSERT INTO events (id, title, type, due_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [event.id, event.title, event.type, event.dueDate, timestamp, timestamp]
    );

    return res.status(201).json({ event });
  })
);

app.patch(
  "/api/admin/events/:id",
  requireUser,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const current = await dbGet("SELECT id, title, type, due_date FROM events WHERE id = ?", [req.params.id]);
    if (!current) {
      return res.status(404).json({ error: "Event not found." });
    }

    const updates = [];
    const params = [];

    if (req.body?.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ error: "title cannot be empty." });
      }
      updates.push("title = ?");
      params.push(title);
    }

    if (req.body?.type !== undefined) {
      const type = normalizeEventType(req.body.type);
      if (!type) {
        return res.status(400).json({ error: "type cannot be empty." });
      }
      updates.push("type = ?");
      params.push(type);
    }

    if (req.body?.dueDate !== undefined) {
      const dueDate = String(req.body.dueDate).trim();
      if (!isIsoDate(dueDate)) {
        return res.status(400).json({ error: "dueDate must use YYYY-MM-DD." });
      }
      updates.push("due_date = ?");
      params.push(dueDate);
    }

    if (updates.length > 0) {
      updates.push("updated_at = ?");
      params.push(nowIso());
      params.push(req.params.id);
      await dbRun(`UPDATE events SET ${updates.join(", ")} WHERE id = ?`, params);
    }

    const updated = await dbGet("SELECT id, title, type, due_date FROM events WHERE id = ?", [req.params.id]);
    return res.json({ event: mapEventRow(updated) });
  })
);

app.delete(
  "/api/admin/events/:id",
  requireUser,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const existing = await dbGet("SELECT id, title, type, due_date FROM events WHERE id = ?", [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: "Event not found." });
    }

    await dbRun("DELETE FROM events WHERE id = ?", [req.params.id]);
    return res.json({ removed: mapEventRow(existing) });
  })
);

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  if (req.path.startsWith("/api/")) {
    return res.status(500).json({ error: "Internal server error." });
  }
  return res.status(500).send("Internal server error.");
});

async function start() {
  await initDatabase(DB_FILE);
  app.listen(PORT, () => {
    console.log(`Event tracker running on http://localhost:${PORT}`);
    console.log(`Using SQLite database at ${DB_FILE}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

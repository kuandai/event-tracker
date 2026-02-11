import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT ?? 3000;
const ADMIN_KEY = process.env.ADMIN_KEY ?? "dev-admin-key";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

app.use(express.json());
app.use(express.static(publicDir));

const VALID_SCOPE = new Set(["upcoming", "past", "all"]);
const VALID_STATUS = new Set(["todo", "done", "all"]);

const events = [
  {
    id: "evt_001",
    title: "Week 2 Homework",
    type: "homework",
    dueDate: "2026-02-18"
  },
  {
    id: "evt_002",
    title: "Quiz 1",
    type: "quiz",
    dueDate: "2026-02-20"
  },
  {
    id: "evt_003",
    title: "Project Proposal",
    type: "assignment",
    dueDate: "2026-02-25"
  }
];

const users = new Map();
const sessions = new Map();

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function getUserFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;
  const username = sessions.get(token);
  if (!username) return null;
  return { username, token };
}

function requireUser(req, res, next) {
  const session = getUserFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Authentication required." });
  }
  req.user = session;
  return next();
}

function requireAdmin(req, res, next) {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(403).json({ error: "Admin access required." });
  }
  return next();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEventType(value) {
  return String(value || "").trim().toLowerCase();
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

  let status = undefined;
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

function toEventResponse(event) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    dueDate: event.dueDate
  };
}

function getCompletionMap(user) {
  if (!user) {
    return new Map();
  }

  if (user.completed instanceof Map) {
    return user.completed;
  }

  if (user.completed instanceof Set) {
    const converted = new Map();
    for (const eventId of user.completed) {
      converted.set(String(eventId), null);
    }
    user.completed = converted;
    return user.completed;
  }

  user.completed = new Map();
  return user.completed;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/events", (req, res) => {
  let query;
  try {
    query = parseListQuery(req.query);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const filtered = filterAndSortEvents(events, query);

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
});

app.post("/api/auth/register", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");

  if (!username || password.length < 6) {
    return res.status(400).json({ error: "Username and 6+ character password required." });
  }

  if (users.has(username)) {
    return res.status(409).json({ error: "User already exists." });
  }

  users.set(username, {
    passwordHash: hashPassword(password),
    completed: new Map()
  });

  return res.status(201).json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
  const username = normalizeUsername(req.body?.username);
  const password = String(req.body?.password || "");
  const user = users.get(username);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = createToken();
  sessions.set(token, username);

  return res.json({ token, username });
});

app.post("/api/auth/logout", requireUser, (req, res) => {
  sessions.delete(req.user.token);
  res.json({ ok: true });
});

app.get("/api/me", requireUser, (req, res) => {
  const user = users.get(req.user.username);
  const completed = user ? Array.from(getCompletionMap(user).keys()) : [];
  res.json({ username: req.user.username, completed });
});

app.get("/api/me/events", requireUser, (req, res) => {
  const user = users.get(req.user.username);
  if (!user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  let query;
  try {
    query = parseListQuery(req.query, { includeStatus: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const completionMap = getCompletionMap(user);
  let filtered = filterAndSortEvents(events, query);

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
});

app.post("/api/me/toggle", requireUser, (req, res) => {
  const eventId = String(req.body?.eventId || "");
  const user = users.get(req.user.username);

  if (!eventId || !user) {
    return res.status(400).json({ error: "Event required." });
  }

  const eventExists = events.some((event) => event.id === eventId);
  if (!eventExists) {
    return res.status(404).json({ error: "Event not found." });
  }

  const completionMap = getCompletionMap(user);
  if (completionMap.has(eventId)) {
    completionMap.delete(eventId);
  } else {
    completionMap.set(eventId, new Date().toISOString());
  }

  return res.json({ completed: Array.from(completionMap.keys()) });
});

app.post("/api/admin/events", requireAdmin, (req, res) => {
  const title = String(req.body?.title || "").trim();
  const type = normalizeEventType(req.body?.type);
  const dueDate = String(req.body?.dueDate || "").trim();

  if (!title || !type || !isIsoDate(dueDate)) {
    return res.status(400).json({ error: "Title, type, and dueDate (YYYY-MM-DD) required." });
  }

  const newEvent = {
    id: `evt_${crypto.randomBytes(4).toString("hex")}`,
    title,
    type,
    dueDate
  };

  events.push(newEvent);
  return res.status(201).json({ event: newEvent });
});

app.patch("/api/admin/events/:id", requireAdmin, (req, res) => {
  const event = events.find((item) => item.id === req.params.id);
  if (!event) {
    return res.status(404).json({ error: "Event not found." });
  }

  const title = req.body?.title;
  const type = req.body?.type;
  const dueDate = req.body?.dueDate;

  if (title !== undefined) {
    const normalizedTitle = String(title).trim();
    if (!normalizedTitle) {
      return res.status(400).json({ error: "title cannot be empty." });
    }
    event.title = normalizedTitle;
  }
  if (type !== undefined) {
    const normalizedType = normalizeEventType(type);
    if (!normalizedType) {
      return res.status(400).json({ error: "type cannot be empty." });
    }
    event.type = normalizedType;
  }
  if (dueDate !== undefined) {
    const normalizedDueDate = String(dueDate).trim();
    if (!isIsoDate(normalizedDueDate)) {
      return res.status(400).json({ error: "dueDate must use YYYY-MM-DD." });
    }
    event.dueDate = normalizedDueDate;
  }

  return res.json({ event });
});

app.delete("/api/admin/events/:id", requireAdmin, (req, res) => {
  const index = events.findIndex((item) => item.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Event not found." });
  }

  const [removed] = events.splice(index, 1);
  return res.json({ removed });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Event tracker running on http://localhost:${PORT}`);
});

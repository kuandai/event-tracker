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

const events = [
  {
    id: "evt_001",
    title: "Week 2 Homework",
    type: "Homework",
    dueDate: "2026-02-18"
  },
  {
    id: "evt_002",
    title: "Quiz 1",
    type: "Quiz",
    dueDate: "2026-02-20"
  },
  {
    id: "evt_003",
    title: "Project Proposal",
    type: "Assignment",
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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/events", (req, res) => {
  const sorted = [...events].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  res.json({ events: sorted });
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
    completed: new Set()
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
  const completed = user ? Array.from(user.completed) : [];
  res.json({ username: req.user.username, completed });
});

app.post("/api/me/toggle", requireUser, (req, res) => {
  const eventId = String(req.body?.eventId || "");
  const user = users.get(req.user.username);

  if (!eventId || !user) {
    return res.status(400).json({ error: "Event required." });
  }

  if (user.completed.has(eventId)) {
    user.completed.delete(eventId);
  } else {
    user.completed.add(eventId);
  }

  return res.json({ completed: Array.from(user.completed) });
});

app.post("/api/admin/events", requireAdmin, (req, res) => {
  const title = String(req.body?.title || "").trim();
  const type = String(req.body?.type || "").trim();
  const dueDate = String(req.body?.dueDate || "").trim();

  if (!title || !type || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
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

  if (title !== undefined) event.title = String(title).trim();
  if (type !== undefined) event.type = String(type).trim();
  if (dueDate !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(dueDate))) {
    event.dueDate = String(dueDate).trim();
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

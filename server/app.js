import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createRequireUser, requireAdmin } from "./middleware/auth.js";
import { registerAdminRoutes } from "./routes/admin-routes.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerEventRoutes } from "./routes/event-routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

export function createApp({ dbAll, dbGet, dbRun }) {
  const app = express();

  app.use(express.json());
  app.use(express.static(publicDir));

  const requireUser = createRequireUser(dbGet);

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  registerAuthRoutes(app, {
    dbAll,
    dbGet,
    dbRun,
    requireUser
  });

  registerEventRoutes(app, {
    dbAll,
    dbGet,
    dbRun,
    requireUser
  });

  registerAdminRoutes(app, {
    dbGet,
    dbRun,
    requireUser,
    requireAdmin
  });

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

  return app;
}

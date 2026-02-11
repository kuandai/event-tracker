import crypto from "crypto";
import { mapEventRow } from "../lib/event-query.js";
import {
  asyncRoute,
  isIsoDate,
  normalizeEventType,
  nowIso
} from "../lib/helpers.js";

export function registerAdminRoutes(app, { dbGet, dbRun, requireUser, requireAdmin }) {
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
}

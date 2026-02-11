import {
  filterAndSortEvents,
  getCompletedIds,
  getCompletionMapForUser,
  listEventsFromDb,
  paginate,
  parseListQuery,
  toEventResponse
} from "../lib/event-query.js";
import {
  asyncRoute,
  nowIso
} from "../lib/helpers.js";

export function registerEventRoutes(app, { dbAll, dbGet, dbRun, requireUser }) {
  app.get(
    "/api/events",
    asyncRoute(async (req, res) => {
      let query;
      try {
        query = parseListQuery(req.query);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }

      const dbEvents = await listEventsFromDb(dbAll);
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

      const completionMap = await getCompletionMapForUser(dbAll, req.user.userId);
      let filtered = filterAndSortEvents(await listEventsFromDb(dbAll), query);

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

      const completed = await getCompletedIds(dbAll, req.user.userId);
      return res.json({ completed });
    })
  );
}

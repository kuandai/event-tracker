import { isIsoDate, normalizeEventType } from "./helpers.js";

const VALID_SCOPE = new Set(["upcoming", "past", "all"]);
const VALID_STATUS = new Set(["todo", "done", "all"]);

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

function localTodayIso() {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function parseListQuery(query, options = {}) {
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

export function filterAndSortEvents(items, query) {
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

export function paginate(items, cursor, limit) {
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

export function mapEventRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    dueDate: row.due_date ?? row.dueDate
  };
}

export function toEventResponse(event) {
  return {
    id: event.id,
    title: event.title,
    type: event.type,
    dueDate: event.dueDate
  };
}

export async function listEventsFromDb(dbAll) {
  const rows = await dbAll("SELECT id, title, type, due_date FROM events");
  return rows.map(mapEventRow);
}

export async function getCompletionMapForUser(dbAll, userId) {
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

export async function getCompletedIds(dbAll, userId) {
  const rows = await dbAll("SELECT event_id AS eventId FROM completions WHERE user_id = ? ORDER BY event_id", [userId]);
  return rows.map((row) => String(row.eventId));
}

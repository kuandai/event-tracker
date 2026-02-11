import crypto from "crypto";

const VALID_USER_ROLE = new Set(["admin", "user"]);

export function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeEventType(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return VALID_USER_ROLE.has(role) ? role : "user";
}

export function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

export function nowIso() {
  return new Date().toISOString();
}

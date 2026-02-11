import fs from "fs/promises";
import path from "path";
import sqlite3 from "sqlite3";

const Sqlite = sqlite3.verbose();
let database = null;

function ensureDatabase() {
  if (!database) {
    throw new Error("Database has not been initialized.");
  }
  return database;
}

function openDatabase(filename) {
  return new Promise((resolve, reject) => {
    const connection = new Sqlite.Database(filename, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(connection);
    });
  });
}

export async function initDatabase(filename) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  database = await openDatabase(filename);

  await exec("PRAGMA foreign_keys = ON;");
  await exec("PRAGMA journal_mode = WAL;");
  await exec("PRAGMA synchronous = NORMAL;");

  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username_display TEXT NOT NULL,
      username_normalized TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      due_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS completions (
      user_id INTEGER NOT NULL,
      event_id TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, event_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_due_date ON events(due_date);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_completions_user_id ON completions(user_id);
  `);
}

export function run(sql, params = []) {
  const db = ensureDatabase();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        lastID: this.lastID,
        changes: this.changes
      });
    });
  });
}

export function get(sql, params = []) {
  const db = ensureDatabase();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

export function all(sql, params = []) {
  const db = ensureDatabase();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

export function exec(sql) {
  const db = ensureDatabase();
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

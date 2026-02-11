import path from "path";
import { fileURLToPath } from "url";
import { all as dbAll, get as dbGet, initDatabase, run as dbRun } from "./db.js";
import { createApp } from "./app.js";

const PORT = process.env.PORT ?? 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE ?? path.join(__dirname, "..", "data", "event-tracker.db");

async function start() {
  await initDatabase(DB_FILE);

  const app = createApp({
    dbAll,
    dbGet,
    dbRun
  });

  app.listen(PORT, () => {
    console.log(`Event tracker running on http://localhost:${PORT}`);
    console.log(`Using SQLite database at ${DB_FILE}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

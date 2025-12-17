import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

// Database path - default to ./data/storynexus.db, overridable via environment variable
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "storynexus.db");

// Create SQLite connection
const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrency
sqlite.pragma("journal_mode = WAL");

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Export schema for use in queries
export { schema };

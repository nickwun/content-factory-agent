import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

export function openSqliteDatabase(filename: string) {
  return new Database(filename);
}

const DEFAULT_DB_PATH = join(process.cwd(), "data", "content-agent.sqlite");

let appDatabase: Database.Database | null = null;

export function getAppDatabase() {
  if (!appDatabase) {
    mkdirSync(dirname(DEFAULT_DB_PATH), { recursive: true });
    appDatabase = openSqliteDatabase(DEFAULT_DB_PATH);
  }

  return appDatabase;
}

export function setAppDatabaseForTesting(database: Database.Database | null) {
  appDatabase = database;
}

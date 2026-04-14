import type Database from "better-sqlite3";

import type { SourceAccount } from "./types.ts";

type SourceAccountRow = {
  id: string;
  platform: "wechat";
  name: string;
  handle: string | null;
  category: string | null;
  priority: number;
  status: "active" | "paused";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function createSourceAccountRepository(db: Database.Database) {
  return {
    list() {
      const rows = db
        .prepare(
          `SELECT id, platform, name, handle, category, priority, status, notes, created_at, updated_at
           FROM topic_source_accounts
           ORDER BY priority DESC, updated_at DESC, name COLLATE NOCASE ASC`,
        )
        .all() as SourceAccountRow[];

      return rows.map(mapRow);
    },

    getById(id: string) {
      const row = db
        .prepare(
          `SELECT id, platform, name, handle, category, priority, status, notes, created_at, updated_at
           FROM topic_source_accounts
           WHERE id = ?`,
        )
        .get(id) as SourceAccountRow | undefined;

      return row ? mapRow(row) : null;
    },

    create(input: SourceAccount) {
      db.prepare(
        `INSERT INTO topic_source_accounts (
          id, platform, name, handle, category, priority, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.id,
        input.platform,
        input.name,
        input.handle ?? null,
        input.category ?? null,
        input.priority,
        input.status,
        input.notes ?? null,
        input.createdAt,
        input.updatedAt,
      );

      return this.getById(input.id);
    },

    update(
      id: string,
      input: Partial<
        Pick<SourceAccount, "name" | "handle" | "category" | "priority" | "status" | "notes">
      > & { updatedAt: string },
    ) {
      const current = this.getById(id);

      if (!current) {
        return null;
      }

      db.prepare(
        `UPDATE topic_source_accounts
         SET name = ?, handle = ?, category = ?, priority = ?, status = ?, notes = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        input.name ?? current.name,
        input.handle ?? current.handle ?? null,
        input.category ?? current.category ?? null,
        input.priority ?? current.priority,
        input.status ?? current.status,
        input.notes ?? current.notes ?? null,
        input.updatedAt,
        id,
      );

      return this.getById(id);
    },

    delete(id: string) {
      return db.prepare(`DELETE FROM topic_source_accounts WHERE id = ?`).run(id).changes;
    },
  };
}

export function ensureSourceAccountsTable(db: Database.Database) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS topic_source_accounts (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      handle TEXT,
      category TEXT,
      priority INTEGER NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();

  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_topic_source_accounts_priority
     ON topic_source_accounts(priority DESC, updated_at DESC)`,
  ).run();

  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_source_accounts_name_unique
     ON topic_source_accounts(platform, name COLLATE NOCASE)`,
  ).run();

  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_source_accounts_handle_unique
     ON topic_source_accounts(platform, handle COLLATE NOCASE)
     WHERE handle IS NOT NULL`,
  ).run();
}

function mapRow(row: SourceAccountRow): SourceAccount {
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    ...(row.handle ? { handle: row.handle } : {}),
    ...(row.category ? { category: row.category } : {}),
    priority: row.priority,
    status: row.status,
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

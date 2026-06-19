import type Database from "better-sqlite3";

import type { RewriteTask } from "./types.ts";

type RewriteTaskRow = {
  id: string;
  cluster_id: string;
  selected_article_ids_json: string;
  brief_json: string;
  status: RewriteTask["status"];
  generated_record_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export function createRewriteTaskRepository(db: Database.Database) {
  return {
    list() {
      const rows = db
        .prepare(
          `SELECT id, cluster_id, selected_article_ids_json, brief_json, status,
                  generated_record_id, error, created_at, updated_at
           FROM topic_rewrite_tasks
           ORDER BY created_at DESC, updated_at DESC`,
        )
        .all() as RewriteTaskRow[];

      return rows.map(mapRow);
    },

    getById(id: string) {
      const row = db
        .prepare(
          `SELECT id, cluster_id, selected_article_ids_json, brief_json, status,
                  generated_record_id, error, created_at, updated_at
           FROM topic_rewrite_tasks
           WHERE id = ?`,
        )
        .get(id) as RewriteTaskRow | undefined;

      return row ? mapRow(row) : null;
    },

    create(input: RewriteTask) {
      db.prepare(
        `INSERT INTO topic_rewrite_tasks (
          id, cluster_id, selected_article_ids_json, brief_json, status,
          generated_record_id, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.id,
        input.clusterId,
        JSON.stringify(input.selectedArticleIds),
        JSON.stringify(input.brief),
        input.status,
        input.generatedRecordId ?? null,
        input.error ?? null,
        input.createdAt,
        input.updatedAt,
      );

      return this.getById(input.id);
    },

    update(
      id: string,
      input: Partial<Pick<RewriteTask, "status" | "generatedRecordId" | "error">> & {
        updatedAt: string;
      },
    ) {
      const current = this.getById(id);

      if (!current) {
        return null;
      }

      db.prepare(
        `UPDATE topic_rewrite_tasks
         SET status = ?, generated_record_id = ?, error = ?, updated_at = ?
         WHERE id = ?`,
      ).run(
        input.status ?? current.status,
        input.generatedRecordId ?? current.generatedRecordId ?? null,
        input.error ?? current.error ?? null,
        input.updatedAt,
        id,
      );

      return this.getById(id);
    },
  };
}

export function ensureRewriteTasksTable(db: Database.Database) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS topic_rewrite_tasks (
      id TEXT PRIMARY KEY,
      cluster_id TEXT NOT NULL,
      selected_article_ids_json TEXT NOT NULL,
      brief_json TEXT NOT NULL,
      status TEXT NOT NULL,
      generated_record_id TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(cluster_id) REFERENCES topic_clusters(id) ON DELETE CASCADE
    )`,
  ).run();

  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_topic_rewrite_tasks_created_at
     ON topic_rewrite_tasks(created_at DESC, updated_at DESC)`,
  ).run();
}

function mapRow(row: RewriteTaskRow): RewriteTask {
  return {
    id: row.id,
    clusterId: row.cluster_id,
    selectedArticleIds: parseStringArray(row.selected_article_ids_json),
    brief: parseBrief(row.brief_json),
    status: row.status,
    ...(row.generated_record_id ? { generatedRecordId: row.generated_record_id } : {}),
    ...(row.error ? { error: row.error } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseStringArray(value: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is string => typeof item === "string");
}

function parseBrief(value: string): RewriteTask["brief"] {
  const parsed = JSON.parse(value) as RewriteTask["brief"];

  return {
    topicTitle: parsed.topicTitle,
    topicSummary: parsed.topicSummary,
    keyAngles: Array.isArray(parsed.keyAngles) ? parsed.keyAngles : [],
    representativeArticleIds: Array.isArray(parsed.representativeArticleIds)
      ? parsed.representativeArticleIds
      : [],
    rewriteGoal: parsed.rewriteGoal,
    styleProfile: parsed.styleProfile,
  };
}

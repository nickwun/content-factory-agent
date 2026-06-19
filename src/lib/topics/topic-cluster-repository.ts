import type Database from "better-sqlite3";

import type { TopicCluster } from "./types.ts";

type TopicClusterRow = {
  id: string;
  topic_title: string;
  topic_title_source: TopicCluster["topicTitleSource"];
  topic_summary: string;
  keywords_json: string;
  article_ids_json: string;
  status: TopicCluster["status"];
  created_at: string;
  updated_at: string;
};

export function createTopicClusterRepository(db: Database.Database) {
  return {
    list() {
      const rows = db
        .prepare(
          `SELECT id, topic_title, topic_title_source, topic_summary, keywords_json,
                  article_ids_json, status, created_at, updated_at
           FROM topic_clusters
           ORDER BY created_at DESC, updated_at DESC`,
        )
        .all() as TopicClusterRow[];

      return rows.map(mapRow);
    },

    getById(id: string) {
      const row = db
        .prepare(
          `SELECT id, topic_title, topic_title_source, topic_summary, keywords_json,
                  article_ids_json, status, created_at, updated_at
           FROM topic_clusters
           WHERE id = ?`,
        )
        .get(id) as TopicClusterRow | undefined;

      return row ? mapRow(row) : null;
    },

    replaceAll(clusters: TopicCluster[]) {
      const deleteStatement = db.prepare(`DELETE FROM topic_clusters`);
      const insertStatement = db.prepare(
        `INSERT INTO topic_clusters (
          id, topic_title, topic_title_source, topic_summary, keywords_json,
          article_ids_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const writeAll = db.transaction((items: TopicCluster[]) => {
        deleteStatement.run();

        for (const item of items) {
          insertStatement.run(
            item.id,
            item.topicTitle,
            item.topicTitleSource,
            item.topicSummary,
            JSON.stringify(item.keywords),
            JSON.stringify(item.articleIds),
            item.status,
            item.createdAt,
            item.updatedAt,
          );
        }
      });

      writeAll(clusters);
      return this.list();
    },

    updateStatus(id: string, status: TopicCluster["status"], updatedAt: string) {
      db.prepare(
        `UPDATE topic_clusters
         SET status = ?, updated_at = ?
         WHERE id = ?`,
      ).run(status, updatedAt, id);

      return this.getById(id);
    },
  };
}

export function ensureTopicClustersTable(db: Database.Database) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS topic_clusters (
      id TEXT PRIMARY KEY,
      topic_title TEXT NOT NULL,
      topic_title_source TEXT NOT NULL,
      topic_summary TEXT NOT NULL,
      keywords_json TEXT NOT NULL,
      article_ids_json TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run();

  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_topic_clusters_created_at
     ON topic_clusters(created_at DESC, updated_at DESC)`,
  ).run();
}

function mapRow(row: TopicClusterRow): TopicCluster {
  return {
    id: row.id,
    topicTitle: row.topic_title,
    topicTitleSource: row.topic_title_source,
    topicSummary: row.topic_summary,
    keywords: parseJsonArray(row.keywords_json),
    articleIds: parseJsonArray(row.article_ids_json),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseJsonArray(value: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is string => typeof item === "string");
}

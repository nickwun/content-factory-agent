import type Database from "better-sqlite3";

import type { TopicScore } from "./types.ts";

type TopicScoreRow = {
  cluster_id: string;
  novelty_score: number;
  fit_score: number;
  evidence_score: number;
  rewrite_potential_score: number;
  total_score: number;
  reasons_json: string;
  scored_at: string;
};

export function createTopicScoreRepository(db: Database.Database) {
  return {
    list() {
      const rows = db
        .prepare(
          `SELECT cluster_id, novelty_score, fit_score, evidence_score,
                  rewrite_potential_score, total_score, reasons_json, scored_at
           FROM topic_scores
           ORDER BY total_score DESC, scored_at DESC`,
        )
        .all() as TopicScoreRow[];

      return rows.map(mapRow);
    },

    replaceAll(scores: TopicScore[]) {
      const deleteStatement = db.prepare(`DELETE FROM topic_scores`);
      const insertStatement = db.prepare(
        `INSERT INTO topic_scores (
          cluster_id, novelty_score, fit_score, evidence_score,
          rewrite_potential_score, total_score, reasons_json, scored_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const writeAll = db.transaction((items: TopicScore[]) => {
        deleteStatement.run();

        for (const item of items) {
          insertStatement.run(
            item.clusterId,
            item.noveltyScore,
            item.fitScore,
            item.evidenceScore,
            item.rewritePotentialScore,
            item.totalScore,
            JSON.stringify(item.reasons),
            item.scoredAt,
          );
        }
      });

      writeAll(scores);
      return this.list();
    },
  };
}

export function ensureTopicScoresTable(db: Database.Database) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS topic_scores (
      cluster_id TEXT PRIMARY KEY,
      novelty_score INTEGER NOT NULL,
      fit_score INTEGER NOT NULL,
      evidence_score INTEGER NOT NULL,
      rewrite_potential_score INTEGER NOT NULL,
      total_score INTEGER NOT NULL,
      reasons_json TEXT NOT NULL,
      scored_at TEXT NOT NULL,
      FOREIGN KEY(cluster_id) REFERENCES topic_clusters(id) ON DELETE CASCADE
    )`,
  ).run();

  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_topic_scores_total
     ON topic_scores(total_score DESC, scored_at DESC)`,
  ).run();
}

function mapRow(row: TopicScoreRow): TopicScore {
  return {
    clusterId: row.cluster_id,
    noveltyScore: row.novelty_score,
    fitScore: row.fit_score,
    evidenceScore: row.evidence_score,
    rewritePotentialScore: row.rewrite_potential_score,
    totalScore: row.total_score,
    reasons: parseReasons(row.reasons_json),
    scoredAt: row.scored_at,
  };
}

function parseReasons(value: string) {
  const parsed = JSON.parse(value) as unknown;

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is string => typeof item === "string");
}

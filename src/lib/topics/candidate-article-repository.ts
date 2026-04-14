import type Database from "better-sqlite3";

import type { CandidateArticle } from "./types.ts";

type CandidateArticleRow = {
  id: string;
  source_account_id: string;
  source_type: CandidateArticle["sourceType"];
  title: string;
  author_name: string | null;
  published_at: string | null;
  url: string | null;
  content_markdown: string | null;
  excerpt: string | null;
  char_count: number | null;
  status: CandidateArticle["status"];
  fingerprint: string;
  created_at: string;
  updated_at: string;
};

export function createCandidateArticleRepository(db: Database.Database) {
  return {
    list() {
      const rows = db
        .prepare(
          `SELECT id, source_account_id, source_type, title, author_name, published_at, url,
                  content_markdown, excerpt, char_count, status, fingerprint, created_at, updated_at
           FROM topic_candidate_articles
           ORDER BY created_at DESC, updated_at DESC`,
        )
        .all() as CandidateArticleRow[];

      return rows.map(mapRow);
    },

    getById(id: string) {
      const row = db
        .prepare(
          `SELECT id, source_account_id, source_type, title, author_name, published_at, url,
                  content_markdown, excerpt, char_count, status, fingerprint, created_at, updated_at
           FROM topic_candidate_articles
           WHERE id = ?`,
        )
        .get(id) as CandidateArticleRow | undefined;

      return row ? mapRow(row) : null;
    },

    getByIds(ids: string[]) {
      if (ids.length === 0) {
        return [] as CandidateArticle[];
      }

      const placeholders = ids.map(() => "?").join(", ");
      const rows = db
        .prepare(
          `SELECT id, source_account_id, source_type, title, author_name, published_at, url,
                  content_markdown, excerpt, char_count, status, fingerprint, created_at, updated_at
           FROM topic_candidate_articles
           WHERE id IN (${placeholders})`,
        )
        .all(...ids) as CandidateArticleRow[];

      const rowMap = new Map(rows.map((row) => [row.id, mapRow(row)]));
      return ids.map((id) => rowMap.get(id)).filter((item): item is CandidateArticle => Boolean(item));
    },

    findBySourceAccountAndFingerprint(sourceAccountId: string, fingerprint: string) {
      const row = db
        .prepare(
          `SELECT id, source_account_id, source_type, title, author_name, published_at, url,
                  content_markdown, excerpt, char_count, status, fingerprint, created_at, updated_at
           FROM topic_candidate_articles
           WHERE source_account_id = ? AND fingerprint = ?`,
        )
        .get(sourceAccountId, fingerprint) as CandidateArticleRow | undefined;

      return row ? mapRow(row) : null;
    },

    countBySourceAccountId(sourceAccountId: string) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS count
           FROM topic_candidate_articles
           WHERE source_account_id = ?`,
        )
        .get(sourceAccountId) as { count: number };

      return row.count;
    },

    create(input: CandidateArticle) {
      db.prepare(
        `INSERT INTO topic_candidate_articles (
          id, source_account_id, source_type, title, author_name, published_at, url,
          content_markdown, excerpt, char_count, status, fingerprint, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        input.id,
        input.sourceAccountId,
        input.sourceType,
        input.title,
        input.authorName ?? null,
        input.publishedAt ?? null,
        input.url ?? null,
        input.contentMarkdown ?? null,
        input.excerpt ?? null,
        input.charCount ?? null,
        input.status,
        input.fingerprint,
        input.createdAt,
        input.updatedAt,
      );

      return this.getById(input.id);
    },

    updateStatusByIds(ids: string[], status: CandidateArticle["status"]) {
      if (ids.length === 0) {
        return 0;
      }

      const placeholders = ids.map(() => "?").join(", ");
      const updatedAt = new Date().toISOString();

      return db
        .prepare(
          `UPDATE topic_candidate_articles
           SET status = ?, updated_at = ?
           WHERE id IN (${placeholders})`,
        )
        .run(status, updatedAt, ...ids).changes;
    },
  };
}

export function ensureCandidateArticlesTable(db: Database.Database) {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS topic_candidate_articles (
      id TEXT PRIMARY KEY,
      source_account_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      title TEXT NOT NULL,
      author_name TEXT,
      published_at TEXT,
      url TEXT,
      content_markdown TEXT,
      excerpt TEXT,
      char_count INTEGER,
      status TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(source_account_id) REFERENCES topic_source_accounts(id) ON DELETE CASCADE
    )`,
  ).run();

  db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_topic_candidate_articles_source
     ON topic_candidate_articles(source_account_id, created_at DESC)`,
  ).run();

  db.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_candidate_articles_fingerprint_unique
     ON topic_candidate_articles(source_account_id, fingerprint)`,
  ).run();
}

function mapRow(row: CandidateArticleRow): CandidateArticle {
  return {
    id: row.id,
    sourceAccountId: row.source_account_id,
    sourceType: row.source_type,
    title: row.title,
    ...(row.author_name ? { authorName: row.author_name } : {}),
    ...(row.published_at ? { publishedAt: row.published_at } : {}),
    ...(row.url ? { url: row.url } : {}),
    ...(row.content_markdown ? { contentMarkdown: row.content_markdown } : {}),
    ...(row.excerpt ? { excerpt: row.excerpt } : {}),
    ...(typeof row.char_count === "number" ? { charCount: row.char_count } : {}),
    status: row.status,
    fingerprint: row.fingerprint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

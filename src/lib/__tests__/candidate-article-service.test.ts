import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase } from "../db/sqlite.ts";
import {
  createCandidateArticleRepository,
  ensureCandidateArticlesTable,
} from "../topics/candidate-article-repository.ts";
import {
  CandidateArticleError,
  createCandidateArticleService,
} from "../topics/candidate-article-service.ts";
import {
  createSourceAccountRepository,
  ensureSourceAccountsTable,
} from "../topics/source-account-repository.ts";
import { createSourceAccountService } from "../topics/source-account-service.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("candidate article service creates manual articles and lists latest first", () => {
  const { candidateArticleService, sourceAccountService } = createService();
  const sourceAccountId = createSourceAccountId(sourceAccountService);

  const older = candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "跑步不是为了赢别人",
    contentMarkdown: "第一段\n\n第二段",
  });

  const newer = candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "人到中年，先把训练过成日常",
    contentMarkdown: "正文开头\n\n正文结尾",
  });

  const listed = candidateArticleService.listCandidateArticles();

  assert.equal(listed.length, 2);
  assert.equal(listed[0]?.id, newer.id);
  assert.equal(listed[1]?.id, older.id);
  assert.equal(listed[0]?.sourceType, "manual_import");
});

test("candidate article service rejects unknown source account", () => {
  const { candidateArticleService } = createService();

  assert.throws(
    () =>
      candidateArticleService.createManualCandidateArticle({
        sourceAccountId: "missing",
        title: "无来源文章",
        contentMarkdown: "正文",
      }),
    (error: unknown) =>
      error instanceof CandidateArticleError &&
      error.code === "source_account_not_found",
  );
});

test("candidate article service rejects duplicate fingerprint within one source account", () => {
  const { candidateArticleService, sourceAccountService } = createService();
  const sourceAccountId = createSourceAccountId(sourceAccountService);

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId,
    title: "重复文章",
    contentMarkdown: "同一段内容\n\n第二段",
  });

  assert.throws(
    () =>
      candidateArticleService.createManualCandidateArticle({
        sourceAccountId,
        title: " 重复文章 ",
        contentMarkdown: "同一段内容\n\n第二段",
      }),
    (error: unknown) =>
      error instanceof CandidateArticleError &&
      error.code === "duplicate_candidate_article",
  );
});

test("candidate article service ingests uploaded files with normalized markdown and derived title", async () => {
  const { candidateArticleService, sourceAccountService } = createService();
  const sourceAccountId = createSourceAccountId(sourceAccountService);

  const article = await candidateArticleService.ingestCandidateArticleFile({
    sourceAccountId,
    file: createFileLike(
      "runner-note.md",
      "text/markdown",
      "# 跑步的慢，是一种长期主义\n\n第一段\n\n第二段",
    ),
  });

  assert.equal(article.sourceType, "file_import");
  assert.equal(article.title, "跑步的慢，是一种长期主义");
  assert.equal(
    article.contentMarkdown,
    "# 跑步的慢，是一种长期主义\n\n第一段\n\n第二段",
  );
  assert.equal(article.status, "ingested");
  assert.ok(article.charCount && article.charCount > 0);
  assert.ok(article.excerpt?.startsWith("跑步的慢，是一种长期主义"));
});

function createService() {
  const db = createTempDb();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);

  const sourceAccountRepository = createSourceAccountRepository(db);
  const candidateArticleRepository = createCandidateArticleRepository(db);
  const sourceAccountService = createSourceAccountService(sourceAccountRepository);

  return {
    candidateArticleService: createCandidateArticleService({
      candidateArticleRepository,
      sourceAccountRepository,
    }),
    sourceAccountService,
  };
}

function createSourceAccountId(
  sourceAccountService: ReturnType<typeof createSourceAccountService>,
) {
  return sourceAccountService.createSourceAccount({
    name: "跑步长期样本",
    handle: "runner-core",
    priority: 80,
  }).id;
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-candidate-articles-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  return openSqliteDatabase(filename);
}

function createFileLike(name: string, type: string, content: string) {
  const bytes = new TextEncoder().encode(content);

  return {
    name,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    },
  };
}

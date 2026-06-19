import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase } from "../db/sqlite.ts";
import {
  createSourceAccountRepository,
  ensureSourceAccountsTable,
} from "../topics/source-account-repository.ts";
import {
  createCandidateArticleRepository,
  ensureCandidateArticlesTable,
} from "../topics/candidate-article-repository.ts";
import { createCandidateArticleService } from "../topics/candidate-article-service.ts";
import {
  createSourceAccountService,
  SourceAccountError,
} from "../topics/source-account-service.ts";

const tempPaths: string[] = [];

afterEach(() => {
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("source account service creates and lists accounts ordered by priority", () => {
  const service = createService();

  const core = service.createSourceAccount({
    name: "核心跑步号",
    handle: "running-core",
    category: "跑步",
    priority: 100,
    status: "active",
    notes: "核心样本源",
  });

  const watch = service.createSourceAccount({
    name: "普通观察号",
    handle: "watch-list",
    category: "观察",
    priority: 40,
    status: "paused",
    notes: "普通观察源",
  });

  const listed = service.listSourceAccounts();

  assert.equal(listed.length, 2);
  assert.equal(listed[0]?.id, core.id);
  assert.equal(listed[1]?.id, watch.id);
  assert.equal(listed[0]?.priority, 100);
  assert.equal(listed[1]?.priority, 40);
});

test("source account service updates status and priority", () => {
  const service = createService();
  const created = service.createSourceAccount({
    name: "待观察账号",
    priority: 20,
  });

  const updated = service.updateSourceAccount(created.id, {
    status: "paused",
    priority: 80,
    notes: "转为暂停观察",
  });

  assert.equal(updated.status, "paused");
  assert.equal(updated.priority, 80);
  assert.equal(updated.notes, "转为暂停观察");
});

test("source account service rejects invalid priority", () => {
  const service = createService();

  assert.throws(
    () =>
      service.createSourceAccount({
        name: "异常优先级",
        priority: -1,
      }),
    (error: unknown) =>
      error instanceof SourceAccountError &&
      error.code === "invalid_source_account_priority",
  );
});

test("source account service rejects duplicate name within wechat platform", () => {
  const service = createService();

  service.createSourceAccount({
    name: "跑步长期样本",
    handle: "runner-core",
  });

  assert.throws(
    () =>
      service.createSourceAccount({
        name: "  跑步长期样本  ",
        handle: "runner-alt",
      }),
    (error: unknown) =>
      error instanceof SourceAccountError &&
      error.code === "duplicate_source_account_name",
  );
});

test("source account service rejects duplicate handle within wechat platform", () => {
  const service = createService();

  service.createSourceAccount({
    name: "跑步长期样本",
    handle: "runner-core",
  });

  assert.throws(
    () =>
      service.createSourceAccount({
        name: "另一个样本",
        handle: " runner-core ",
      }),
    (error: unknown) =>
      error instanceof SourceAccountError &&
      error.code === "duplicate_source_account_handle",
  );
});

test("source account service blocks deletion when candidate articles are linked", () => {
  const db = createTempDb();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);
  const sourceAccountRepository = createSourceAccountRepository(db);
  const candidateArticleRepository = createCandidateArticleRepository(db);
  const service = createSourceAccountService({
    sourceAccountRepository,
    candidateArticleRepository,
  });
  const candidateArticleService = createCandidateArticleService({
    candidateArticleRepository,
    sourceAccountRepository,
  });

  const sourceAccount = service.createSourceAccount({
    name: "不可删除样本源",
    handle: "locked-source",
  });

  candidateArticleService.createManualCandidateArticle({
    sourceAccountId: sourceAccount.id,
    title: "跑步时不要追求每一次都很燃",
    contentMarkdown: "先把节奏稳住，再谈表现。",
  });

  assert.throws(
    () => service.deleteSourceAccount(sourceAccount.id),
    (error: unknown) =>
      error instanceof SourceAccountError &&
      error.code === "source_account_has_candidate_articles",
  );
});

function createService() {
  const db = createTempDb();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);
  const sourceAccountRepository = createSourceAccountRepository(db);
  const candidateArticleRepository = createCandidateArticleRepository(db);
  return createSourceAccountService({
    sourceAccountRepository,
    candidateArticleRepository,
  });
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-source-accounts-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  return openSqliteDatabase(filename);
}

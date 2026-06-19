import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import { POST as POST_FILE } from "../../app/api/topics/candidate-articles/import-file/route.ts";
import {
  GET,
  POST as POST_MANUAL,
} from "../../app/api/topics/candidate-articles/route.ts";
import { POST as POST_SOURCE_ACCOUNT } from "../../app/api/topics/source-accounts/route.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);

  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("candidate article routes create manual articles and list them", async () => {
  setAppDatabaseForTesting(createTempDb());
  const sourceAccountId = await createSourceAccount();

  const createResponse = await POST_MANUAL(
    new Request("http://localhost/api/topics/candidate-articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAccountId,
        sourceType: "manual_import",
        title: "跑步是一种缓慢的整理",
        contentMarkdown: "第一段\n\n第二段",
      }),
    }) as never,
  );
  const createdPayload = (await createResponse.json()) as {
    candidateArticle: { id: string; sourceType: string; title: string };
  };

  assert.equal(createResponse.status, 201);
  assert.equal(createdPayload.candidateArticle.sourceType, "manual_import");

  const listResponse = await GET(
    new Request("http://localhost/api/topics/candidate-articles") as never,
  );
  const listPayload = (await listResponse.json()) as {
    candidateArticles: Array<{ id: string; title: string }>;
  };

  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.candidateArticles.length, 1);
  assert.equal(
    listPayload.candidateArticles[0]?.id,
    createdPayload.candidateArticle.id,
  );
});

test("candidate article file import route ingests multiple supported files and returns summary", async () => {
  setAppDatabaseForTesting(createTempDb());
  const sourceAccountId = await createSourceAccount();

  const formData = new FormData();
  formData.set("sourceAccountId", sourceAccountId);
  formData.append(
    "file",
    new File(
      [new TextEncoder().encode("# 训练日记\n\n今天只跑了五公里，但很扎实。")],
      "runner-note.md",
      { type: "text/markdown" },
    ),
  );
  formData.append(
    "file",
    new File(
      [new TextEncoder().encode("跑步不是赢别人\n\n先把自己的节奏跑顺。")],
      "runner-note-2.txt",
      { type: "text/plain" },
    ),
  );

  const response = await POST_FILE(
    new Request("http://localhost/api/topics/candidate-articles/import-file", {
      method: "POST",
      body: formData,
    }) as never,
  );
  const payload = (await response.json()) as {
    candidateArticles: Array<{ sourceType: string; title: string }>;
    summary: {
      succeeded: number;
      skippedDuplicates: number;
      failed: number;
    };
  };

  assert.equal(response.status, 201);
  assert.equal(payload.summary.succeeded, 2);
  assert.equal(payload.summary.skippedDuplicates, 0);
  assert.equal(payload.summary.failed, 0);
  assert.equal(payload.candidateArticles.length, 2);
  assert.equal(payload.candidateArticles[0]?.sourceType, "file_import");
  assert.equal(payload.candidateArticles[0]?.title, "训练日记");
});

test("candidate article file import route reports duplicates and failures in summary", async () => {
  setAppDatabaseForTesting(createTempDb());
  const sourceAccountId = await createSourceAccount();

  const formData = new FormData();
  formData.set("sourceAccountId", sourceAccountId);
  formData.append(
    "file",
    new File(
      [new TextEncoder().encode("# 训练日记\n\n今天只跑了五公里，但很扎实。")],
      "runner-note.md",
      { type: "text/markdown" },
    ),
  );
  formData.append(
    "file",
    new File(
      [new TextEncoder().encode("# 训练日记\n\n今天只跑了五公里，但很扎实。")],
      "runner-note-duplicate.md",
      { type: "text/markdown" },
    ),
  );
  formData.append(
    "file",
    new File(
      [new Uint8Array([1, 2, 3, 4])],
      "broken.bin",
      { type: "application/octet-stream" },
    ),
  );

  const response = await POST_FILE(
    new Request("http://localhost/api/topics/candidate-articles/import-file", {
      method: "POST",
      body: formData,
    }) as never,
  );
  const payload = (await response.json()) as {
    candidateArticles: Array<{ sourceType: string; title: string }>;
    summary: {
      succeeded: number;
      skippedDuplicates: number;
      failed: number;
    };
  };

  assert.equal(response.status, 201);
  assert.equal(payload.summary.succeeded, 1);
  assert.equal(payload.summary.skippedDuplicates, 1);
  assert.equal(payload.summary.failed, 1);
  assert.equal(payload.candidateArticles.length, 1);
});

async function createSourceAccount() {
  const response = await POST_SOURCE_ACCOUNT(
    new Request("http://localhost/api/topics/source-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "跑步长期样本",
        handle: "runner-core",
        priority: 80,
      }),
    }) as never,
  );
  const payload = (await response.json()) as { sourceAccount: { id: string } };
  return payload.sourceAccount.id;
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-candidate-article-routes-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}

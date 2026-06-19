import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import { POST as POST_CANDIDATE_ARTICLE } from "../../app/api/topics/candidate-articles/route.ts";
import { POST as POST_CLUSTERS } from "../../app/api/topics/clusters/route.ts";
import {
  createPromptSettingsRepository as createLegacyPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "../settings/prompt-settings-repository.ts";
import {
  createPromptPresetRepository,
  ensurePromptPresetsTable,
} from "../settings/prompt-preset-repository.ts";
import { createPromptPresetService } from "../settings/prompt-preset-service.ts";
import { getDefaultPromptTemplates } from "../settings/prompt-settings-service.ts";
import {
  GET as GET_REWRITE_TASKS,
  POST as POST_REWRITE_TASKS,
} from "../../app/api/topics/rewrite-tasks/route.ts";
import { PATCH as PATCH_REWRITE_TASK } from "../../app/api/topics/rewrite-tasks/[id]/route.ts";
import { POST as POST_SOURCE_ACCOUNT } from "../../app/api/topics/source-accounts/route.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);

  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("rewrite task routes create, list, and update rewrite tasks", async () => {
  const db = createTempDb();
  setAppDatabaseForTesting(db);
  const sourceAccountId = await createSourceAccount();

  await createCandidateArticle({
    sourceAccountId,
    title: "跑步不是为了赢别人",
    contentMarkdown: "跑步是为了慢慢稳住自己的节奏。",
  });
  const promptPreset = createPromptPreset(db, {
    name: "跑步长文提示词",
    platform: "wechat_article",
    promptTemplate: "写得更像长期主义跑者的公众号复盘。",
  });
  await POST_CLUSTERS(
    new Request("http://localhost/api/topics/clusters", {
      method: "POST",
    }) as never,
  );

  const clustersResponse = await POST_CLUSTERS(
    new Request("http://localhost/api/topics/clusters", {
      method: "POST",
    }) as never,
  );
  const clustersPayload = (await clustersResponse.json()) as {
    topicClusters: Array<{ id: string }>;
  };
  const clusterId = clustersPayload.topicClusters[0]!.id;

  const createResponse = await POST_REWRITE_TASKS(
    new Request("http://localhost/api/topics/rewrite-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clusterId, promptPresetId: promptPreset.id }),
    }) as never,
  );
  const createPayload = (await createResponse.json()) as {
    rewriteTask: { id: string; status: string; brief: { topicTitle: string } };
    generatePayload: { userPrompt: string };
  };

  assert.equal(createResponse.status, 201);
  assert.equal(createPayload.rewriteTask.status, "running");
  assert.ok(createPayload.generatePayload.userPrompt.length > 0);
  assert.equal(
    createPayload.generatePayload.userPrompt.includes("当前使用提示词预设「跑步长文提示词」。"),
    true,
  );

  const listResponse = await GET_REWRITE_TASKS(
    new Request("http://localhost/api/topics/rewrite-tasks") as never,
  );
  const listPayload = (await listResponse.json()) as {
    rewriteTasks: Array<{ id: string; status: string }>;
  };

  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.rewriteTasks.length, 1);

  const updateResponse = await PATCH_REWRITE_TASK(
    new Request(`http://localhost/api/topics/rewrite-tasks/${createPayload.rewriteTask.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "succeeded",
        generatedRecordId: "record-1",
      }),
    }) as never,
    {
      params: Promise.resolve({ id: createPayload.rewriteTask.id }),
    },
  );
  const updatePayload = (await updateResponse.json()) as {
    rewriteTask: { status: string; generatedRecordId: string };
  };

  assert.equal(updateResponse.status, 200);
  assert.equal(updatePayload.rewriteTask.status, "succeeded");
  assert.equal(updatePayload.rewriteTask.generatedRecordId, "record-1");
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

async function createCandidateArticle(input: {
  sourceAccountId: string;
  title: string;
  contentMarkdown: string;
}) {
  await POST_CANDIDATE_ARTICLE(
    new Request("http://localhost/api/topics/candidate-articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }) as never,
  );
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-rewrite-task-routes-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}

function createPromptPreset(
  db: ReturnType<typeof openSqliteDatabase>,
  input: {
  name: string;
  platform: "wechat_article";
  promptTemplate: string;
}) {
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createLegacyPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  const repository = createPromptPresetRepository(db);
  const service = createPromptPresetService(repository);
  return service.createPromptPreset(input);
}

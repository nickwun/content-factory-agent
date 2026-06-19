import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import {
  createPromptSettingsRepository as createLegacyPromptSettingsRepository,
  ensurePromptSettingsTable,
} from "../settings/prompt-settings-repository.ts";
import {
  createPromptPresetRepository,
  ensurePromptPresetsTable,
} from "../settings/prompt-preset-repository.ts";
import { getDefaultPromptTemplates } from "../settings/prompt-settings-service.ts";
import {
  GET as listPresetRoute,
  POST as createPresetRoute,
} from "../../app/api/prompt-presets/route.ts";
import { PATCH as updatePresetRoute } from "../../app/api/prompt-presets/[id]/route.ts";
import {
  GET as listCorpusRoute,
  POST as uploadCorpusRoute,
} from "../../app/api/prompt-presets/[id]/corpus/route.ts";
import { DELETE as deleteCorpusRoute } from "../../app/api/prompt-presets/[id]/corpus/[fileId]/route.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);
  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("prompt preset corpus routes upload, replace, and delete corpus files", async () => {
  const db = createTempDb();
  const repository = createPromptPresetRepository(db);
  const presetId = repository.getDefaultByPlatform("wechat_article")?.id;

  assert.ok(presetId);

  const uploadFormData = new FormData();
  uploadFormData.set(
    "file",
    new File(["第一段\n\n第二段"], "runner-tone.txt", { type: "text/plain" }),
  );

  const uploadResponse = await uploadCorpusRoute(
    new Request(`http://localhost/api/prompt-presets/${presetId}/corpus`, {
      method: "POST",
      body: uploadFormData,
    }),
    { params: Promise.resolve({ id: presetId }) },
  );

  assert.equal(uploadResponse.status, 201);
  const uploadPayload = (await uploadResponse.json()) as {
    corpusFile: { id: string; fileName: string; summary?: { lengthHint?: string } };
  };
  assert.equal(uploadPayload.corpusFile.fileName, "runner-tone.txt");
  assert.ok(uploadPayload.corpusFile.summary?.lengthHint);

  const corpusListResponse = await listCorpusRoute(
    new Request(`http://localhost/api/prompt-presets/${presetId}/corpus`),
    { params: Promise.resolve({ id: presetId }) },
  );
  const corpusListPayload = (await corpusListResponse.json()) as {
    corpusFiles: Array<{ id: string }>;
  };

  assert.equal(corpusListResponse.status, 200);
  assert.equal(corpusListPayload.corpusFiles.length, 1);

  const replaceFormData = new FormData();
  replaceFormData.set(
    "file",
    new File(["新版正文"], "runner-tone-v2.txt", { type: "text/plain" }),
  );
  replaceFormData.set("replaceFileId", uploadPayload.corpusFile.id);

  const replaceResponse = await uploadCorpusRoute(
    new Request(`http://localhost/api/prompt-presets/${presetId}/corpus`, {
      method: "POST",
      body: replaceFormData,
    }),
    { params: Promise.resolve({ id: presetId }) },
  );

  assert.equal(replaceResponse.status, 201);
  const replacePayload = (await replaceResponse.json()) as {
    corpusFile: { id: string; fileName: string };
  };
  assert.notEqual(replacePayload.corpusFile.id, uploadPayload.corpusFile.id);
  assert.equal(replacePayload.corpusFile.fileName, "runner-tone-v2.txt");

  const deleteResponse = await deleteCorpusRoute(
    new Request(
      `http://localhost/api/prompt-presets/${presetId}/corpus/${replacePayload.corpusFile.id}`,
      { method: "DELETE" },
    ),
    {
      params: Promise.resolve({
        id: presetId,
        fileId: replacePayload.corpusFile.id,
      }),
    },
  );

  assert.equal(deleteResponse.status, 200);

  const finalListResponse = await listCorpusRoute(
    new Request(`http://localhost/api/prompt-presets/${presetId}/corpus`),
    { params: Promise.resolve({ id: presetId }) },
  );
  const finalListPayload = (await finalListResponse.json()) as {
    corpusFiles: Array<{ id: string }>;
  };

  assert.equal(finalListPayload.corpusFiles.length, 0);
});

test("prompt preset routes preserve processing mode for translation presets", async () => {
  createTempDb();

  const createResponse = await createPresetRoute(
    new Request("http://localhost/api/prompt-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "wechat_article",
        name: "YouTube 翻译整理",
        promptTemplate: "把英文文稿整理成自然中文文章。",
        processingMode: "translate_to_zh_article",
      }),
    }),
  );

  assert.equal(createResponse.status, 201);
  const createPayload = (await createResponse.json()) as {
    preset: { id: string; processingMode: string };
  };
  assert.equal(createPayload.preset.processingMode, "translate_to_zh_article");

  const updateResponse = await updatePresetRoute(
    new Request(`http://localhost/api/prompt-presets/${createPayload.preset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        processingMode: "rewrite",
      }),
    }),
    { params: Promise.resolve({ id: createPayload.preset.id }) },
  );

  assert.equal(updateResponse.status, 200);
  const updatePayload = (await updateResponse.json()) as {
    preset: { processingMode: string };
  };
  assert.equal(updatePayload.preset.processingMode, "rewrite");

  const listResponse = await listPresetRoute({
    nextUrl: new URL("http://localhost/api/prompt-presets"),
  } as never);
  const listPayload = (await listResponse.json()) as {
    presetGroups: Array<{
      platform: string;
      presets: Array<{ id: string; processingMode: string }>;
    }>;
  };
  const listedPreset = listPayload.presetGroups
    .find((group) => group.platform === "wechat_article")
    ?.presets.find((preset) => preset.id === createPayload.preset.id);

  assert.equal(listedPreset?.processingMode, "rewrite");
});

test("prompt preset routes reject invalid processing mode", async () => {
  createTempDb();

  const response = await createPresetRoute(
    new Request("http://localhost/api/prompt-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: "wechat_article",
        name: "错误模式",
        promptTemplate: "任意提示词",
        processingMode: "summarize",
      }),
    }),
  );

  assert.equal(response.status, 400);
});

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-prompt-preset-routes-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);

  const db = openSqliteDatabase(filename);
  ensurePromptSettingsTable(db, getDefaultPromptTemplates());
  const legacyRepository = createLegacyPromptSettingsRepository(db);
  ensurePromptPresetsTable(db, legacyRepository.list());
  createPromptPresetRepository(db);
  setAppDatabaseForTesting(db);

  return db;
}

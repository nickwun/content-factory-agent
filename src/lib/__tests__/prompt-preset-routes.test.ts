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

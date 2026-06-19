import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import {
  DELETE,
  PATCH,
} from "../../app/api/topics/source-accounts/[id]/route.ts";
import { POST as POST_ARTICLE } from "../../app/api/topics/candidate-articles/route.ts";
import { GET, POST } from "../../app/api/topics/source-accounts/route.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);

  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("source account routes create, list, update, and delete accounts", async () => {
  setAppDatabaseForTesting(createTempDb());

  const createResponse = await POST(
    new Request("http://localhost/api/topics/source-accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "跑步长期样本",
        handle: "runner-longform",
        category: "跑步",
        priority: 90,
        status: "active",
      }),
    }) as never,
  );
  const createdPayload = (await createResponse.json()) as {
    sourceAccount: { id: string; priority: number; name: string };
  };

  assert.equal(createResponse.status, 201);
  assert.equal(createdPayload.sourceAccount.name, "跑步长期样本");
  assert.equal(createdPayload.sourceAccount.priority, 90);

  const listResponse = await GET(
    new Request("http://localhost/api/topics/source-accounts") as never,
  );
  const listPayload = (await listResponse.json()) as {
    sourceAccounts: Array<{ id: string; name: string }>;
  };

  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.sourceAccounts.length, 1);
  assert.equal(listPayload.sourceAccounts[0]?.id, createdPayload.sourceAccount.id);

  const updateResponse = await PATCH(
    new Request(`http://localhost/api/topics/source-accounts/${createdPayload.sourceAccount.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "paused",
        priority: 50,
      }),
    }) as never,
    {
      params: Promise.resolve({ id: createdPayload.sourceAccount.id }),
    },
  );
  const updatedPayload = (await updateResponse.json()) as {
    sourceAccount: { status: string; priority: number };
  };

  assert.equal(updateResponse.status, 200);
  assert.equal(updatedPayload.sourceAccount.status, "paused");
  assert.equal(updatedPayload.sourceAccount.priority, 50);

  const deleteResponse = await DELETE(
    new Request(`http://localhost/api/topics/source-accounts/${createdPayload.sourceAccount.id}`, {
      method: "DELETE",
    }) as never,
    {
      params: Promise.resolve({ id: createdPayload.sourceAccount.id }),
    },
  );
  const deletedPayload = (await deleteResponse.json()) as { success: boolean };

  assert.equal(deleteResponse.status, 200);
  assert.equal(deletedPayload.success, true);
});

test("source account post route rejects missing name", async () => {
  setAppDatabaseForTesting(createTempDb());

  const response = await POST(
    new Request("http://localhost/api/topics/source-accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        priority: 80,
      }),
    }) as never,
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 400);
  assert.equal(payload.error, "name is required");
});

test("source account delete route blocks deletion when linked candidate articles exist", async () => {
  setAppDatabaseForTesting(createTempDb());
  const sourceAccountId = await createSourceAccount();

  await POST_ARTICLE(
    new Request("http://localhost/api/topics/candidate-articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceAccountId,
        sourceType: "manual_import",
        title: "跑步不是赢别人",
        contentMarkdown: "先跑稳，再谈速度。",
      }),
    }) as never,
  );

  const deleteResponse = await DELETE(
    new Request(`http://localhost/api/topics/source-accounts/${sourceAccountId}`, {
      method: "DELETE",
    }) as never,
    {
      params: Promise.resolve({ id: sourceAccountId }),
    },
  );
  const payload = (await deleteResponse.json()) as {
    error: { code: string; message: string };
  };

  assert.equal(deleteResponse.status, 400);
  assert.equal(payload.error.code, "source_account_has_candidate_articles");
});

async function createSourceAccount() {
  const response = await POST(
    new Request("http://localhost/api/topics/source-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "跑步长期样本",
        handle: `runner-longform-${Math.random()}`,
        category: "跑步",
        priority: 90,
        status: "active",
      }),
    }) as never,
  );
  const payload = (await response.json()) as { sourceAccount: { id: string } };
  return payload.sourceAccount.id;
}

function createTempDb() {
  const filename = join(
    tmpdir(),
    `content-agent-source-account-routes-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}

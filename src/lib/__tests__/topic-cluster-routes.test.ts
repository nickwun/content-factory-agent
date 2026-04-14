import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { openSqliteDatabase, setAppDatabaseForTesting } from "../db/sqlite.ts";
import { GET, POST } from "../../app/api/topics/clusters/route.ts";
import { PATCH } from "../../app/api/topics/clusters/[id]/route.ts";
import { POST as POST_SOURCE_ACCOUNT } from "../../app/api/topics/source-accounts/route.ts";
import { POST as POST_CANDIDATE_ARTICLE } from "../../app/api/topics/candidate-articles/route.ts";

const tempPaths: string[] = [];

afterEach(() => {
  setAppDatabaseForTesting(null);

  for (const path of tempPaths.splice(0)) {
    rmSync(path, { force: true });
  }
});

test("topic cluster routes rebuild clusters and list them", async () => {
  setAppDatabaseForTesting(createTempDb());
  const sourceAccountId = await createSourceAccount();

  await createCandidateArticle({
    sourceAccountId,
    title: "跑步是中年人的长期主义",
    contentMarkdown: "跑步不是为了赢别人，而是为了把生活慢慢稳住。",
  });
  await createCandidateArticle({
    sourceAccountId,
    title: "长期训练最怕节奏乱掉",
    contentMarkdown: "训练这件事，最先要保住的不是强度，而是节奏。",
  });

  const rebuildResponse = await POST(
    new Request("http://localhost/api/topics/clusters", {
      method: "POST",
    }) as never,
  );
  const rebuildPayload = (await rebuildResponse.json()) as {
    topicClusters: Array<{ articleIds: string[]; topicTitleSource: string }>;
    topicScores: Array<{ clusterId: string; totalScore: number; reasons: string[] }>;
  };

  assert.equal(rebuildResponse.status, 200);
  assert.equal(rebuildPayload.topicClusters.length, 1);
  assert.equal(rebuildPayload.topicScores.length, 1);
  assert.equal(rebuildPayload.topicClusters[0]?.articleIds.length, 2);
  assert.equal(rebuildPayload.topicClusters[0]?.topicTitleSource, "rule_based");
  assert.ok(rebuildPayload.topicScores[0]!.totalScore > 0);
  assert.ok(rebuildPayload.topicScores[0]!.reasons.length > 0);

  const listResponse = await GET(
    new Request("http://localhost/api/topics/clusters") as never,
  );
  const listPayload = (await listResponse.json()) as {
    topicClusters: Array<{ id: string; topicTitle: string }>;
    topicScores: Array<{ clusterId: string; totalScore: number }>;
  };

  assert.equal(listResponse.status, 200);
  assert.equal(listPayload.topicClusters.length, 1);
  assert.equal(listPayload.topicScores.length, 1);
  assert.ok(listPayload.topicClusters[0]?.id);
  assert.ok(listPayload.topicClusters[0]?.topicTitle);
});

test("topic cluster routes can reject a cluster", async () => {
  setAppDatabaseForTesting(createTempDb());
  const sourceAccountId = await createSourceAccount();

  await createCandidateArticle({
    sourceAccountId,
    title: "跑步是把日子慢慢跑稳",
    contentMarkdown: "节奏先稳住，很多事情才会慢慢归位。",
  });

  const rebuildResponse = await POST(
    new Request("http://localhost/api/topics/clusters", {
      method: "POST",
    }) as never,
  );
  const rebuildPayload = (await rebuildResponse.json()) as {
    topicClusters: Array<{ id: string; status: string }>;
  };
  const clusterId = rebuildPayload.topicClusters[0]?.id;

  assert.ok(clusterId);

  const patchResponse = await PATCH(
    new Request(`http://localhost/api/topics/clusters/${clusterId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    }) as never,
    { params: Promise.resolve({ id: clusterId! }) },
  );
  const patchPayload = (await patchResponse.json()) as {
    topicCluster?: { id: string; status: string };
    error?: unknown;
  };

  assert.equal(patchResponse.status, 200);
  assert.equal(patchPayload.topicCluster?.id, clusterId);
  assert.equal(patchPayload.topicCluster?.status, "rejected");
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
    `content-agent-topic-cluster-routes-${Date.now()}-${Math.random()}.sqlite`,
  );

  tempPaths.push(filename);
  return openSqliteDatabase(filename);
}

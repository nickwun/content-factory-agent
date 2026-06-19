import assert from "node:assert/strict";
import test from "node:test";

import { createFeishuTenantAccessTokenResolver } from "../publish/feishu-access-token.ts";
import { PublishServiceError } from "../publish/publish-errors.ts";

test("feishu tenant access token resolver caches token until expiration window", async () => {
  let requests = 0;
  const resolver = createFeishuTenantAccessTokenResolver({
    safetyWindowMs: 60_000,
  });

  const credentials = {
    appId: "cli_app_id",
    appSecret: "secret",
  };

  const fetcher: typeof fetch = async (input, init) => {
    requests += 1;
    assert.ok(init?.signal instanceof AbortSignal);
    assert.equal(
      String(input),
      "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    );
    assert.equal(init?.method, "POST");

    return new Response(
      JSON.stringify({
        code: 0,
        tenant_access_token: "tenant-token-1",
        expire: 7200,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const first = await resolver(credentials, { fetcher, now: 1_000 });
  const second = await resolver(credentials, { fetcher, now: 2_000 });

  assert.equal(first, "tenant-token-1");
  assert.equal(second, "tenant-token-1");
  assert.equal(requests, 1);
});

test("feishu tenant access token resolver refreshes token after expiration window", async () => {
  let requests = 0;
  const resolver = createFeishuTenantAccessTokenResolver({
    safetyWindowMs: 60_000,
  });

  const credentials = {
    appId: "cli_app_id",
    appSecret: "secret",
  };

  const fetcher: typeof fetch = async () => {
    requests += 1;

    return new Response(
      JSON.stringify({
        code: 0,
        tenant_access_token: `tenant-token-${requests}`,
        expire: 120,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const first = await resolver(credentials, { fetcher, now: 1_000 });
  const second = await resolver(credentials, { fetcher, now: 70_000 });

  assert.equal(first, "tenant-token-1");
  assert.equal(second, "tenant-token-2");
  assert.equal(requests, 2);
});

test("feishu tenant access token resolver maps request timeout into publish error", async () => {
  const resolver = createFeishuTenantAccessTokenResolver({
    requestTimeoutMs: 5,
    safetyWindowMs: 60_000,
  });

  await assert.rejects(
    async () => {
      await resolver(
        {
          appId: "cli_app_id",
          appSecret: "secret",
        },
        {
          fetcher: (_input, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
          now: 1_000,
        },
      );
    },
    (error: unknown) => {
      assert.ok(error instanceof PublishServiceError);
      assert.equal(error.code, "upstream_timeout");
      assert.equal(error.status, 504);
      assert.match(error.message, /tenant token.*5ms/);
      return true;
    },
  );
});

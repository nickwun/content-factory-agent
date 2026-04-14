import assert from "node:assert/strict";
import test from "node:test";

import { createFeishuTenantAccessTokenResolver } from "../publish/feishu-access-token.ts";

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

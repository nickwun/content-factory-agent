import assert from "node:assert/strict";
import test from "node:test";

import {
  MissingPublicImageStorageConfigError,
  getPublicImageStorageConfig,
} from "../env/public-image-storage.ts";

test("getPublicImageStorageConfig reads supabase storage config", () => {
  const previousProvider = process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousBucket = process.env.SUPABASE_STORAGE_BUCKET;

  process.env.PUBLIC_IMAGE_STORAGE_PROVIDER = "supabase";
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_STORAGE_BUCKET = "wechat-covers";

  assert.deepEqual(getPublicImageStorageConfig(), {
    provider: "supabase",
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceRoleKey: "service-role-key",
    bucket: "wechat-covers",
  });

  restoreEnv(previousProvider, previousUrl, previousKey, previousBucket);
});

test("getPublicImageStorageConfig infers supabase provider when vars are present", () => {
  const previousProvider = process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousBucket = process.env.SUPABASE_STORAGE_BUCKET;

  delete process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_STORAGE_BUCKET = "wechat-covers";

  assert.equal(getPublicImageStorageConfig().provider, "supabase");

  restoreEnv(previousProvider, previousUrl, previousKey, previousBucket);
});

test("getPublicImageStorageConfig throws a clear error when storage config is missing", () => {
  const previousProvider = process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousBucket = process.env.SUPABASE_STORAGE_BUCKET;

  process.env.PUBLIC_IMAGE_STORAGE_PROVIDER = "supabase";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_STORAGE_BUCKET;

  assert.throws(
    () => getPublicImageStorageConfig(),
    MissingPublicImageStorageConfigError,
  );

  restoreEnv(previousProvider, previousUrl, previousKey, previousBucket);
});

function restoreEnv(
  provider: string | undefined,
  url: string | undefined,
  key: string | undefined,
  bucket: string | undefined,
) {
  if (provider === undefined) {
    delete process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  } else {
    process.env.PUBLIC_IMAGE_STORAGE_PROVIDER = provider;
  }

  if (url === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = url;
  }

  if (key === undefined) {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    process.env.SUPABASE_SERVICE_ROLE_KEY = key;
  }

  if (bucket === undefined) {
    delete process.env.SUPABASE_STORAGE_BUCKET;
  } else {
    process.env.SUPABASE_STORAGE_BUCKET = bucket;
  }
}

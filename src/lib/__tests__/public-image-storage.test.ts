import assert from "node:assert/strict";
import test from "node:test";

import {
  PublicImageStorageError,
  uploadPublicImage,
} from "../images/public-image-storage.ts";

const SAMPLE_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wn7Y6cAAAAASUVORK5CYII=";

test("uploadPublicImage uploads image bytes to supabase storage and returns a public url", async () => {
  const previousProvider = process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousBucket = process.env.SUPABASE_STORAGE_BUCKET;

  process.env.PUBLIC_IMAGE_STORAGE_PROVIDER = "supabase";
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_STORAGE_BUCKET = "public-assets";

  let capturedUrl = "";
  let capturedHeaders: Headers | undefined;
  let capturedBody: BodyInit | null | undefined;

  const result = await uploadPublicImage(
    {
      dataUrl: SAMPLE_PNG_DATA_URL,
      folder: "wechat-covers",
      fileNamePrefix: "wechat-cover",
    },
    async (input, init) => {
      capturedUrl = String(input);
      capturedHeaders = new Headers(init?.headers);
      capturedBody = init?.body;

      return new Response(JSON.stringify({ Key: "ok" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
  );

  assert.match(
    capturedUrl,
    /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public-assets\/wechat-covers\/wechat-cover-/,
  );
  assert.equal(
    capturedHeaders?.get("authorization"),
    "Bearer service-role-key",
  );
  assert.equal(capturedHeaders?.get("apikey"), "service-role-key");
  assert.equal(capturedHeaders?.get("x-upsert"), "true");
  assert.equal(capturedHeaders?.get("content-type"), "image/png");
  assert.ok(capturedBody instanceof Uint8Array);
  assert.match(
    result.publicUrl,
    /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/public-assets\/wechat-covers\/wechat-cover-.*\.png$/,
  );
  assert.equal(result.mimeType, "image/png");
  assert.match(result.storageKey, /^wechat-covers\/wechat-cover-.*\.png$/);

  restoreEnv(previousProvider, previousUrl, previousKey, previousBucket);
});

test("uploadPublicImage throws a clear config error when public storage is missing", async () => {
  const previousProvider = process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousBucket = process.env.SUPABASE_STORAGE_BUCKET;

  process.env.PUBLIC_IMAGE_STORAGE_PROVIDER = "supabase";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_STORAGE_BUCKET;

  await assert.rejects(
    () =>
      uploadPublicImage(
        {
          dataUrl: SAMPLE_PNG_DATA_URL,
          folder: "wechat-covers",
        },
        async () => new Response(null, { status: 200 }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof PublicImageStorageError);
      assert.equal(error.code, "missing_public_image_storage_config");
      return true;
    },
  );

  restoreEnv(previousProvider, previousUrl, previousKey, previousBucket);
});

test("uploadPublicImage surfaces upstream storage upload failures", async () => {
  const previousProvider = process.env.PUBLIC_IMAGE_STORAGE_PROVIDER;
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousBucket = process.env.SUPABASE_STORAGE_BUCKET;

  process.env.PUBLIC_IMAGE_STORAGE_PROVIDER = "supabase";
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  process.env.SUPABASE_STORAGE_BUCKET = "public-assets";

  await assert.rejects(
    () =>
      uploadPublicImage(
        {
          dataUrl: SAMPLE_PNG_DATA_URL,
          folder: "wechat-covers",
        },
        async () => new Response("bucket not found", { status: 404 }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof PublicImageStorageError);
      assert.equal(error.code, "public_image_upload_failed");
      assert.match(error.message, /bucket not found/);
      return true;
    },
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

import { resolveFeishuTenantAccessToken, type FeishuAppCredentials } from "./feishu-access-token.ts";
import { PublishServiceError } from "./publish-errors.ts";
import type {
  FeishuCoverSyncFailureReason,
  FeishuDocxBlock,
  FeishuPublishPayload,
  FeishuPublishResponse,
} from "./types.ts";

type PublishFeishuDocumentOptions = {
  fetcher?: typeof fetch;
  now?: number;
  resolveTenantAccessToken?: typeof resolveFeishuTenantAccessToken;
};

type FeishuDocumentInfo = {
  documentId: string;
  documentUrl: string;
};

const FEISHU_DOCX_CHILDREN_BATCH_SIZE = 50;

export async function publishFeishuDocument(
  credentials: FeishuAppCredentials,
  payload: FeishuPublishPayload,
  options: PublishFeishuDocumentOptions = {},
): Promise<FeishuPublishResponse> {
  const fetcher = options.fetcher ?? fetch;
  const accessToken = await (options.resolveTenantAccessToken ??
    resolveFeishuTenantAccessToken)(credentials, {
    fetcher,
    now: options.now,
  });

  const document = await createFeishuDocument(accessToken, payload.title, fetcher);
  await appendDocumentBlocks(
    accessToken,
    document.documentId,
    document.documentId,
    payload.blocks,
    fetcher,
  );

  if (!payload.coverImageUrl) {
    return {
      success: true,
      documentId: document.documentId,
      documentUrl: document.documentUrl,
      bodyPublished: true,
      coverSyncStatus: "skipped",
      message: "飞书文档已创建，正文已发布。",
    };
  }

  const coverSyncResult = await trySyncCoverImageToFeishuDocument(
    accessToken,
    document.documentId,
    payload.coverImageUrl,
    fetcher,
  );

  if (coverSyncResult.ok) {
    return {
      success: true,
      documentId: document.documentId,
      documentUrl: document.documentUrl,
      bodyPublished: true,
      coverSyncStatus: "synced",
      message: "飞书文档已创建，正文和头图均已同步。",
    };
  }

  return {
    success: true,
    documentId: document.documentId,
    documentUrl: document.documentUrl,
    bodyPublished: true,
    coverSyncStatus: "failed",
    coverSyncFailureReason: coverSyncResult.reason,
    warningMessage: "文档已创建，正文已发布，头图未同步。",
    message: "飞书文档已创建，正文已发布，头图未同步。",
  };
}

async function createFeishuDocument(
  accessToken: string,
  title: string,
  fetcher: typeof fetch,
): Promise<FeishuDocumentInfo> {
  const response = await fetcher("https://open.feishu.cn/open-apis/docx/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ title }),
  });

  const payload = (await response.json().catch(() => undefined)) as
    | {
        code?: number;
        msg?: string;
        data?: {
          document?: {
            document_id?: string;
            url?: string;
          };
          document_id?: string;
          url?: string;
        };
      }
    | undefined;

  if (!response.ok || payload?.code !== 0) {
    throw buildFeishuApiError(response.status, payload?.msg);
  }

  const documentId =
    payload?.data?.document?.document_id?.trim() ||
    payload?.data?.document_id?.trim();
  const documentUrl =
    payload?.data?.document?.url?.trim() ||
    payload?.data?.url?.trim() ||
    (documentId ? `https://feishu.cn/docx/${documentId}` : "");

  if (!documentId || !documentUrl) {
    throw new PublishServiceError(
      "upstream_publish_failed",
      "飞书文档创建成功，但未返回可用文档信息。",
      502,
    );
  }

  return { documentId, documentUrl };
}

async function appendDocumentBlocks(
  accessToken: string,
  documentId: string,
  parentBlockId: string,
  blocks: FeishuDocxBlock[],
  fetcher: typeof fetch,
  index?: number,
) {
  const children: Array<{ block_id?: string }> = [];

  for (const blockChunk of chunkFeishuBlocks(blocks, FEISHU_DOCX_CHILDREN_BATCH_SIZE)) {
    const nextChildren = await appendDocumentBlockChunk(
      accessToken,
      documentId,
      parentBlockId,
      blockChunk,
      fetcher,
      index,
    );
    children.push(...nextChildren);
  }

  return children;
}

async function appendDocumentBlockChunk(
  accessToken: string,
  documentId: string,
  parentBlockId: string,
  blocks: FeishuDocxBlock[],
  fetcher: typeof fetch,
  index?: number,
) {
  const query = index === undefined ? "?document_revision_id=-1" : `?document_revision_id=-1&index=${index}`;
  const response = await fetcher(
    `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${parentBlockId}/children${query}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ children: blocks, ...(index === undefined ? {} : { index }) }),
    },
  );

  const payload = (await response.json().catch(() => undefined)) as
    | {
        code?: number;
        msg?: string;
        data?: {
          children?: Array<{ block_id?: string }>;
        };
      }
    | undefined;

  if (!response.ok || payload?.code !== 0) {
    throw buildFeishuApiError(response.status, payload?.msg);
  }

  return payload?.data?.children ?? [];
}

function chunkFeishuBlocks(
  blocks: FeishuDocxBlock[],
  chunkSize: number,
) {
  if (blocks.length === 0) {
    return [];
  }

  const chunks: FeishuDocxBlock[][] = [];
  for (let index = 0; index < blocks.length; index += chunkSize) {
    chunks.push(blocks.slice(index, index + chunkSize));
  }

  return chunks;
}

async function trySyncCoverImageToFeishuDocument(
  accessToken: string,
  documentId: string,
  coverImageUrl: string,
  fetcher: typeof fetch,
): Promise<{ ok: true } | { ok: false; reason: FeishuCoverSyncFailureReason }> {
  try {
    const [imageBlock] = await appendDocumentBlocks(
      accessToken,
      documentId,
      documentId,
      [{ block_type: 27, image: {} }],
      fetcher,
      0,
    );

    const imageBlockId = imageBlock?.block_id?.trim();
    if (!imageBlockId) {
      return { ok: false, reason: "insert_failed" };
    }

    const downloadedImage = await downloadCoverImage(coverImageUrl, fetcher);
    const fileToken = await uploadFeishuImage(
      accessToken,
      downloadedImage,
      imageBlockId,
      fetcher,
    );
    await replaceImageBlock(accessToken, documentId, imageBlockId, fileToken, fetcher);

    return { ok: true };
  } catch (error) {
    if (
      error instanceof PublishServiceError &&
      (error.code === "invalid_image_url" || error.code === "upstream_publish_failed")
    ) {
      return {
        ok: false,
        reason:
          error.message.includes("上传") || error.message.includes("下载")
            ? "upload_failed"
            : "insert_failed",
      };
    }

    return { ok: false, reason: "insert_failed" };
  }
}

async function downloadCoverImage(coverImageUrl: string, fetcher: typeof fetch) {
  const response = await fetcher(coverImageUrl);

  if (!response.ok) {
    throw new PublishServiceError(
      "invalid_image_url",
      "头图下载失败，无法同步到飞书文档。",
      502,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    bytes,
    fileName: inferFileNameFromUrl(coverImageUrl),
    mimeType: response.headers.get("content-type")?.trim() || "image/jpeg",
  };
}

async function uploadFeishuImage(
  accessToken: string,
  image: { bytes: Uint8Array; fileName: string; mimeType: string },
  imageBlockId: string,
  fetcher: typeof fetch,
) {
  const formData = new FormData();
  formData.set(
    "file",
    new Blob([Buffer.from(image.bytes)], { type: image.mimeType }),
    image.fileName,
  );
  formData.set("file_name", image.fileName);
  formData.set("parent_type", "docx_image");
  formData.set("parent_node", imageBlockId);
  formData.set("size", String(image.bytes.byteLength));

  const response = await fetcher(
    "https://open.feishu.cn/open-apis/drive/v1/medias/upload_all",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      body: formData,
    },
  );

  const payload = (await response.json().catch(() => undefined)) as
    | {
        code?: number;
        msg?: string;
        data?: {
          file_token?: string;
        };
      }
    | undefined;

  if (!response.ok || payload?.code !== 0 || !payload?.data?.file_token) {
    throw new PublishServiceError(
      "upstream_publish_failed",
      payload?.msg?.trim()
        ? `头图上传到飞书失败：${payload.msg.trim()}`
        : "头图上传到飞书失败。",
      response.status >= 400 ? response.status : 502,
    );
  }

  return payload.data.file_token;
}

async function replaceImageBlock(
  accessToken: string,
  documentId: string,
  imageBlockId: string,
  fileToken: string,
  fetcher: typeof fetch,
) {
  const response = await fetcher(
    `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks/${imageBlockId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        replace_image: {
          token: fileToken,
        },
      }),
    },
  );

  const payload = (await response.json().catch(() => undefined)) as
    | {
        code?: number;
        msg?: string;
      }
    | undefined;

  if (!response.ok || payload?.code !== 0) {
    throw new PublishServiceError(
      "upstream_publish_failed",
      payload?.msg?.trim() || "头图插入飞书文档失败。",
      response.status >= 400 ? response.status : 502,
    );
  }
}

function buildFeishuApiError(status: number, message?: string) {
  if (status === 401) {
    return new PublishServiceError(
      "invalid_api_key",
      message?.trim() || "飞书鉴权失败，请检查 App ID 与 App Secret。",
      401,
    );
  }

  if (status === 429) {
    return new PublishServiceError(
      "rate_limited",
      message?.trim() || "飞书文档发布请求过于频繁。",
      429,
    );
  }

  return new PublishServiceError(
    status >= 500 ? "upstream_unavailable" : "upstream_publish_failed",
    message?.trim() || "飞书文档发布失败。",
    status >= 400 ? status : 502,
  );
}

function inferFileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split("/").filter(Boolean).at(-1);
    return lastSegment || "cover.jpg";
  } catch {
    return "cover.jpg";
  }
}

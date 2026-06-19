import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";

import { parseRewriteFile, type RewriteFileLike } from "../rewrite/rewrite-file-parser.ts";
import { normalizeRewriteText } from "../rewrite/rewrite-source.ts";
import type { SourceAccount } from "./types.ts";
import type { CandidateArticle } from "./types.ts";

type CandidateArticleRepository = {
  list: () => CandidateArticle[];
  create: (input: CandidateArticle) => CandidateArticle | null;
  findBySourceAccountAndFingerprint: (
    sourceAccountId: string,
    fingerprint: string,
  ) => CandidateArticle | null;
};

type SourceAccountRepository = {
  getById: (id: string) => SourceAccount | null;
};

export class CandidateArticleError extends Error {
  readonly code:
    | "source_account_not_found"
    | "invalid_candidate_article_title"
    | "invalid_candidate_article_body"
    | "duplicate_candidate_article";

  constructor(
    code:
      | "source_account_not_found"
      | "invalid_candidate_article_title"
      | "invalid_candidate_article_body"
      | "duplicate_candidate_article",
    message: string,
  ) {
    super(message);
    this.name = "CandidateArticleError";
    this.code = code;
  }
}

export type CandidateArticleFileImportResult = {
  candidateArticles: CandidateArticle[];
  summary: {
    succeeded: number;
    skippedDuplicates: number;
    failed: number;
  };
  failures: Array<{
    filename: string;
    code: string;
    message: string;
  }>;
};

export function createCandidateArticleService(input: {
  candidateArticleRepository: CandidateArticleRepository;
  sourceAccountRepository: SourceAccountRepository;
}) {
  const { candidateArticleRepository, sourceAccountRepository } = input;

  return {
    listCandidateArticles() {
      return candidateArticleRepository.list();
    },

    createManualCandidateArticle(payload: {
      sourceAccountId: string;
      title: string;
      contentMarkdown: string;
      authorName?: string;
      publishedAt?: string;
      url?: string;
    }) {
      const sourceAccount = requireSourceAccount(
        sourceAccountRepository,
        payload.sourceAccountId,
      );

      return createCandidateArticleRecord({
        sourceAccount,
        sourceType: "manual_import",
        title: payload.title,
        contentMarkdown: payload.contentMarkdown,
        authorName: payload.authorName,
        publishedAt: payload.publishedAt,
        url: payload.url,
        candidateArticleRepository,
      });
    },

    async ingestCandidateArticleFile(payload: {
      sourceAccountId: string;
      file: RewriteFileLike;
    }) {
      const sourceAccount = requireSourceAccount(
        sourceAccountRepository,
        payload.sourceAccountId,
      );
      const rewriteSource = await parseRewriteFile(payload.file);

      return createCandidateArticleRecord({
        sourceAccount,
        sourceType: "file_import",
        title: deriveTitleFromImportedBody(
          rewriteSource.extractedText,
          payload.file.name,
        ),
        contentMarkdown: rewriteSource.extractedText,
        candidateArticleRepository,
      });
    },

    async ingestCandidateArticleFiles(payload: {
      sourceAccountId: string;
      files: RewriteFileLike[];
    }): Promise<CandidateArticleFileImportResult> {
      const candidateArticles: CandidateArticle[] = [];
      const failures: CandidateArticleFileImportResult["failures"] = [];
      let skippedDuplicates = 0;

      for (const file of payload.files) {
        try {
          const candidateArticle = await this.ingestCandidateArticleFile({
            sourceAccountId: payload.sourceAccountId,
            file,
          });
          candidateArticles.push(candidateArticle);
        } catch (error) {
          if (
            error instanceof CandidateArticleError &&
            error.code === "duplicate_candidate_article"
          ) {
            skippedDuplicates += 1;
            continue;
          }

          if (error instanceof CandidateArticleError || error instanceof Error) {
            failures.push({
              filename: file.name,
              code:
                error instanceof CandidateArticleError
                  ? error.code
                  : "unexpected_error",
              message: error.message,
            });
            continue;
          }

          failures.push({
            filename: file.name,
            code: "unexpected_error",
            message: "候选文章文件导入失败。",
          });
        }
      }

      return {
        candidateArticles,
        summary: {
          succeeded: candidateArticles.length,
          skippedDuplicates,
          failed: failures.length,
        },
        failures,
      };
    },
  };
}

function requireSourceAccount(
  repository: SourceAccountRepository,
  sourceAccountId: string,
) {
  const sourceAccount = repository.getById(sourceAccountId);

  if (!sourceAccount) {
    throw new CandidateArticleError(
      "source_account_not_found",
      "候选文章必须关联一个有效的样本源。",
    );
  }

  return sourceAccount;
}

function createCandidateArticleRecord(input: {
  sourceAccount: SourceAccount;
  sourceType: CandidateArticle["sourceType"];
  title: string;
  contentMarkdown: string;
  authorName?: string;
  publishedAt?: string;
  url?: string;
  candidateArticleRepository: CandidateArticleRepository;
}) {
  const now = new Date().toISOString();
  const title = normalizeTitle(input.title);
  const contentMarkdown = normalizeBody(input.contentMarkdown);
  const fingerprint = createCandidateArticleFingerprint({
    title,
    contentMarkdown,
  });

  const existing = input.candidateArticleRepository.findBySourceAccountAndFingerprint(
    input.sourceAccount.id,
    fingerprint,
  );

  if (existing) {
    throw new CandidateArticleError(
      "duplicate_candidate_article",
      "同一样本源下已存在内容相同的候选文章，请不要重复导入。",
    );
  }

  return input.candidateArticleRepository.create({
    id: randomUUID(),
    sourceAccountId: input.sourceAccount.id,
    sourceType: input.sourceType,
    title,
    ...(normalizeOptionalText(input.authorName)
      ? { authorName: normalizeOptionalText(input.authorName) }
      : {}),
    ...(normalizeOptionalText(input.publishedAt)
      ? { publishedAt: normalizeOptionalText(input.publishedAt) }
      : {}),
    ...(normalizeOptionalText(input.url) ? { url: normalizeOptionalText(input.url) } : {}),
    contentMarkdown,
    excerpt: buildExcerpt(contentMarkdown),
    charCount: contentMarkdown.length,
    status: "ingested",
    fingerprint,
    createdAt: now,
    updatedAt: now,
  })!;
}

function normalizeTitle(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new CandidateArticleError(
      "invalid_candidate_article_title",
      "候选文章标题不能为空。",
    );
  }

  return trimmed;
}

function normalizeBody(value: string) {
  const normalized = normalizeRewriteText(value);

  if (!normalized) {
    throw new CandidateArticleError(
      "invalid_candidate_article_body",
      "候选文章正文不能为空。",
    );
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function createCandidateArticleFingerprint(input: {
  title: string;
  contentMarkdown: string;
}) {
  return createHash("sha256")
    .update(`${input.title}\n${input.contentMarkdown}`)
    .digest("hex");
}

function buildExcerpt(contentMarkdown: string) {
  return contentMarkdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 140);
}

function deriveTitleFromImportedBody(contentMarkdown: string, filename: string) {
  const lines = contentMarkdown.split("\n");

  for (const line of lines) {
    const candidate = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^>\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .trim();

    if (candidate) {
      return candidate.slice(0, 80);
    }
  }

  return basename(filename, filename.match(/\.[^.]+$/)?.[0] ?? "").trim() || "未命名候选文章";
}

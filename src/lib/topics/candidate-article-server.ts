import { getAppDatabase } from "../db/sqlite.ts";
import {
  createCandidateArticleRepository,
  ensureCandidateArticlesTable,
} from "./candidate-article-repository.ts";
import {
  CandidateArticleError,
  createCandidateArticleService,
} from "./candidate-article-service.ts";
import {
  createSourceAccountRepository,
  ensureSourceAccountsTable,
} from "./source-account-repository.ts";

function getCandidateArticleService() {
  const db = getAppDatabase();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);

  return createCandidateArticleService({
    candidateArticleRepository: createCandidateArticleRepository(db),
    sourceAccountRepository: createSourceAccountRepository(db),
  });
}

export function listCandidateArticles() {
  return getCandidateArticleService().listCandidateArticles();
}

export function createManualCandidateArticle(input: {
  sourceAccountId: string;
  title: string;
  contentMarkdown: string;
  authorName?: string;
  publishedAt?: string;
  url?: string;
}) {
  return getCandidateArticleService().createManualCandidateArticle(input);
}

export function ingestCandidateArticleFile(input: {
  sourceAccountId: string;
  file: {
    name: string;
    type?: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
}) {
  return getCandidateArticleService().ingestCandidateArticleFile(input);
}

export function ingestCandidateArticleFiles(input: {
  sourceAccountId: string;
  files: Array<{
    name: string;
    type?: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  }>;
}) {
  return getCandidateArticleService().ingestCandidateArticleFiles(input);
}

export { CandidateArticleError };

import { getAppDatabase } from "../db/sqlite.ts";
import {
  createCandidateArticleRepository,
  ensureCandidateArticlesTable,
} from "./candidate-article-repository.ts";
import {
  createSourceAccountRepository,
  ensureSourceAccountsTable,
} from "./source-account-repository.ts";
import {
  createSourceAccountService,
  SourceAccountError,
} from "./source-account-service.ts";
import type { SourceAccount } from "./types.ts";

function getSourceAccountService() {
  const db = getAppDatabase();
  ensureSourceAccountsTable(db);
  ensureCandidateArticlesTable(db);
  const sourceAccountRepository = createSourceAccountRepository(db);
  const candidateArticleRepository = createCandidateArticleRepository(db);
  return createSourceAccountService({
    sourceAccountRepository,
    candidateArticleRepository,
  });
}

export function listSourceAccounts() {
  return getSourceAccountService().listSourceAccounts();
}

export function createSourceAccount(input: {
  name: string;
  handle?: string;
  category?: string;
  priority?: number;
  status?: SourceAccount["status"];
  notes?: string;
}) {
  return getSourceAccountService().createSourceAccount(input);
}

export function updateSourceAccount(
  id: string,
  input: Partial<
    Pick<SourceAccount, "name" | "handle" | "category" | "priority" | "status" | "notes">
  >,
) {
  return getSourceAccountService().updateSourceAccount(id, input);
}

export function deleteSourceAccount(id: string) {
  return getSourceAccountService().deleteSourceAccount(id);
}

export { SourceAccountError };

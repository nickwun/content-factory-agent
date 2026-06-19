import { randomUUID } from "node:crypto";

import type { SourceAccount } from "./types.ts";

type SourceAccountRepository = {
  list: () => SourceAccount[];
  getById: (id: string) => SourceAccount | null;
  create: (input: SourceAccount) => SourceAccount | null;
  update: (
    id: string,
    input: Partial<
      Pick<SourceAccount, "name" | "handle" | "category" | "priority" | "status" | "notes">
    > & { updatedAt: string },
  ) => SourceAccount | null;
  delete: (id: string) => number;
};

type CandidateArticleRepository = {
  countBySourceAccountId: (sourceAccountId: string) => number;
};

export class SourceAccountError extends Error {
  readonly code:
    | "source_account_not_found"
    | "invalid_source_account_name"
    | "invalid_source_account_priority"
    | "duplicate_source_account_name"
    | "duplicate_source_account_handle"
    | "source_account_has_candidate_articles";

  constructor(
    code:
      | "source_account_not_found"
      | "invalid_source_account_name"
      | "invalid_source_account_priority"
      | "duplicate_source_account_name"
      | "duplicate_source_account_handle"
      | "source_account_has_candidate_articles",
    message: string,
  ) {
    super(message);
    this.name = "SourceAccountError";
    this.code = code;
  }
}

export function createSourceAccountService(
  input:
    | SourceAccountRepository
    | {
        sourceAccountRepository: SourceAccountRepository;
        candidateArticleRepository?: CandidateArticleRepository;
      },
) {
  const repository = "sourceAccountRepository" in input ? input.sourceAccountRepository : input;
  const candidateArticleRepository =
    "sourceAccountRepository" in input ? input.candidateArticleRepository : undefined;

  return {
    listSourceAccounts() {
      return repository.list();
    },

    createSourceAccount(input: {
      name: string;
      handle?: string;
      category?: string;
      priority?: number;
      status?: SourceAccount["status"];
      notes?: string;
    }) {
      const now = new Date().toISOString();
      const name = normalizeName(input.name);
      const handle = normalizeOptionalText(input.handle);
      const priority = normalizePriority(input.priority ?? 50);

      ensureNoDuplicateSourceAccount({
        accounts: repository.list(),
        name,
        handle,
      });

      return repository.create({
        id: randomUUID(),
        platform: "wechat",
        name,
        ...(handle ? { handle } : {}),
        ...(normalizeOptionalText(input.category)
          ? { category: normalizeOptionalText(input.category) }
          : {}),
        priority,
        status: input.status ?? "active",
        ...(normalizeOptionalText(input.notes) ? { notes: normalizeOptionalText(input.notes) } : {}),
        createdAt: now,
        updatedAt: now,
      })!;
    },

    updateSourceAccount(
      id: string,
      input: Partial<
        Pick<SourceAccount, "name" | "handle" | "category" | "priority" | "status" | "notes">
      >,
    ) {
      const existing = repository.getById(id);
      if (!existing) {
        throw new SourceAccountError("source_account_not_found", "Source account not found");
      }

      const nextName =
        input.name !== undefined ? normalizeName(input.name) : existing.name;
      const nextHandle =
        input.handle !== undefined ? normalizeOptionalText(input.handle) : existing.handle;

      ensureNoDuplicateSourceAccount({
        accounts: repository.list(),
        name: nextName,
        handle: nextHandle,
        excludeId: id,
      });

      const updated = repository.update(id, {
        ...(input.name !== undefined ? { name: nextName } : {}),
        ...(input.handle !== undefined ? { handle: nextHandle } : {}),
        ...(input.category !== undefined
          ? { category: normalizeOptionalText(input.category) }
          : {}),
        ...(input.priority !== undefined
          ? { priority: normalizePriority(input.priority) }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {}),
        updatedAt: new Date().toISOString(),
      });

      return updated!;
    },

    deleteSourceAccount(id: string) {
      if ((candidateArticleRepository?.countBySourceAccountId(id) ?? 0) > 0) {
        throw new SourceAccountError(
          "source_account_has_candidate_articles",
          "这个样本源下面还有候选文章，先不要直接删除，避免把已入库数据的来源关系删掉。",
        );
      }

      const changes = repository.delete(id);

      if (changes === 0) {
        throw new SourceAccountError("source_account_not_found", "Source account not found");
      }
    },
  };
}

function normalizeName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new SourceAccountError("invalid_source_account_name", "Source account name is required");
  }

  return trimmed;
}

function normalizePriority(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new SourceAccountError(
      "invalid_source_account_priority",
      "Source account priority must be an integer between 0 and 100",
    );
  }

  return value;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function ensureNoDuplicateSourceAccount(input: {
  accounts: SourceAccount[];
  name: string;
  handle?: string;
  excludeId?: string;
}) {
  const normalizedName = input.name.toLocaleLowerCase();
  const normalizedHandle = input.handle?.toLocaleLowerCase();

  for (const account of input.accounts) {
    if (account.id === input.excludeId) {
      continue;
    }

    if (account.name.toLocaleLowerCase() === normalizedName) {
      throw new SourceAccountError(
        "duplicate_source_account_name",
        "同名样本源已存在，请直接编辑原记录，避免候选文章关联混乱。",
      );
    }

    if (
      normalizedHandle &&
      account.handle &&
      account.handle.toLocaleLowerCase() === normalizedHandle
    ) {
      throw new SourceAccountError(
        "duplicate_source_account_handle",
        "同账号标识样本源已存在，请直接编辑原记录，避免候选文章关联混乱。",
      );
    }
  }
}

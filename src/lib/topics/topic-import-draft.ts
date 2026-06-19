export type ManualImportDraft = {
  sourceAccountId: string;
  title: string;
  contentMarkdown: string;
};

export type FileImportDraft = {
  sourceAccountId: string;
  files: File[];
};

export function createEmptyManualImportDraft(
  sourceAccountId = "",
): ManualImportDraft {
  return {
    sourceAccountId,
    title: "",
    contentMarkdown: "",
  };
}

export function createEmptyFileImportDraft(
  sourceAccountId = "",
): FileImportDraft {
  return {
    sourceAccountId,
    files: [],
  };
}

export function normalizeManualImportDraft(
  draft: Partial<ManualImportDraft> | null | undefined,
): ManualImportDraft {
  return {
    sourceAccountId: draft?.sourceAccountId ?? "",
    title: draft?.title ?? "",
    contentMarkdown: draft?.contentMarkdown ?? "",
  };
}

export function normalizeFileImportDraft(
  draft: Partial<FileImportDraft> | null | undefined,
): FileImportDraft {
  return {
    sourceAccountId: draft?.sourceAccountId ?? "",
    files: Array.isArray(draft?.files) ? draft.files.filter((file): file is File => file instanceof File) : [],
  };
}

import type { HistoryRecord } from "../types/history.ts";

export function searchHistoryRecords(
  records: HistoryRecord[],
  query: string,
): HistoryRecord[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [...records];
  }

  return records.filter((record) => {
    const haystack = `${record.title} ${record.userPrompt}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

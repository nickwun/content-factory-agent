import type { HistoryRecord } from "../types/history.ts";

export type HistoryStorageAdapter = {
  list(): Promise<HistoryRecord[]>;
  getById(id: string): Promise<HistoryRecord | null>;
  create(record: HistoryRecord): Promise<void>;
  save(record: HistoryRecord): Promise<HistoryRecord>;
  rename(id: string, title: string): Promise<HistoryRecord | null>;
  remove(id: string): Promise<void>;
  search(query: string): Promise<HistoryRecord[]>;
};

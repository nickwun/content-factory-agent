"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

import { createLocalHistoryStorage } from "@/lib/history/local-history-storage";
import { searchHistoryRecords } from "@/lib/history/history-search";
import type { HistoryRecord, PlatformContentMap } from "@/lib/types/history";
import type { PlatformType, EditorSaveState } from "@/lib/types/platform";
import {
  getVisibleSaveState,
  type PersistenceSource,
} from "@/lib/workspace/workspace-state";
import { useDebouncedAutosave } from "./use-debounced-autosave";

type UseHistoryWorkspaceOptions = {
  autosaveDelay?: number;
};

type CreateRecordOptions = {
  activate?: boolean;
};

export function useHistoryWorkspace(
  options: UseHistoryWorkspaceOptions = {},
) {
  const adapter = useMemo(() => createLocalHistoryStorage(), []);
  const autosaveDelay = options.autosaveDelay ?? 700;

  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveState, setSaveState] = useState<EditorSaveState>("idle");
  const [pendingSaveRecord, setPendingSaveRecord] = useState<{
    record: HistoryRecord;
    source: PersistenceSource;
    requestId: string;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const nextRecords = await adapter.list();

      if (cancelled) {
        return;
      }

      setRecords(nextRecords);
      setActiveRecordId(getMostRecentlyViewedRecord(nextRecords)?.id ?? null);
      setLoaded(true);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const activeRecord = useMemo(
    () => records.find((record) => record.id === activeRecordId) ?? null,
    [activeRecordId, records],
  );

  const filteredRecords = useMemo(
    () => searchHistoryRecords(records, searchQuery),
    [records, searchQuery],
  );

  const replaceRecord = useCallback((record: HistoryRecord) => {
    setRecords((current) =>
      sortRecords([record, ...current.filter((item) => item.id !== record.id)]),
    );
  }, []);

  const createRecord = useCallback(
    async (record: HistoryRecord, options: CreateRecordOptions = {}) => {
      await adapter.create(record);
      replaceRecord(record);
      if (options.activate !== false) {
        setActiveRecordId(record.id);
      }
      setSaveState("saved");
      setPendingSaveRecord(null);
    },
    [adapter, replaceRecord],
  );

  const renameRecord = useCallback(
    async (id: string, title: string) => {
      const renamed = await adapter.rename(id, title.trim());

      if (!renamed) {
        return null;
      }

      replaceRecord(renamed);
      return renamed;
    },
    [adapter, replaceRecord],
  );

  const deleteRecord = useCallback(
    async (id: string) => {
      await adapter.remove(id);
      setRecords((current) => {
        const next = current.filter((record) => record.id !== id);

        if (id === activeRecordId) {
          setActiveRecordId(getMostRecentlyViewedRecord(next)?.id ?? null);
        }

        return next;
      });
    },
    [activeRecordId, adapter],
  );

  const selectRecord = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      const target = records.find((record) => record.id === id);

      if (!target) {
        return;
      }

      const updated: HistoryRecord = {
        ...target,
        workspace: {
          ...target.workspace,
          lastViewedAt: now,
        },
      };

      replaceRecord(updated);
      setActiveRecordId(id);
      setPendingSaveRecord({
        record: updated,
        source: "view",
        requestId: crypto.randomUUID(),
      });
    },
    [records, replaceRecord],
  );

  const updateActiveRecord = useCallback(
    (
      updater: (
        current: HistoryRecord,
      ) => HistoryRecord,
      source: PersistenceSource = "edit",
    ) => {
      let updatedRecord: HistoryRecord | null = null;

      flushSync(() => {
        setRecords((current) => {
          const target = current.find((record) => record.id === activeRecordId);

          if (!target) {
            return current;
          }

          updatedRecord = updater(target);

          return sortRecords([
            updatedRecord,
            ...current.filter((item) => item.id !== updatedRecord?.id),
          ]);
        });
      });

      if (!updatedRecord) {
        return;
      }

      const nextRecord = updatedRecord as HistoryRecord;

      setActiveRecordId(nextRecord.id);

      setSaveState((current) => getVisibleSaveState(current, source, "queued"));
      setPendingSaveRecord({
        record: nextRecord,
        source,
        requestId: crypto.randomUUID(),
      });
    },
    [activeRecordId],
  );

  const updateRecord = useCallback(
    (
      recordId: string,
      updater: (current: HistoryRecord) => HistoryRecord,
      source: PersistenceSource = "edit",
    ) => {
      let updatedRecord: HistoryRecord | null = null;

      flushSync(() => {
        setRecords((current) => {
          const target = current.find((record) => record.id === recordId);

          if (!target) {
            return current;
          }

          updatedRecord = updater(target);

          return sortRecords([
            updatedRecord,
            ...current.filter((item) => item.id !== updatedRecord?.id),
          ]);
        });
      });

      if (!updatedRecord) {
        return;
      }

      const nextRecord = updatedRecord as HistoryRecord;

      if (activeRecordId === nextRecord.id) {
        setActiveRecordId(nextRecord.id);
      }

      setSaveState((current) => getVisibleSaveState(current, source, "queued"));
      setPendingSaveRecord({
        record: nextRecord,
        source,
        requestId: crypto.randomUUID(),
      });
    },
    [activeRecordId],
  );

  const setActivePlatform = useCallback(
    (platform: PlatformType) => {
      updateActiveRecord((record) => ({
        ...record,
        workspace: {
          ...record.workspace,
          activePlatform: platform,
          lastViewedAt: new Date().toISOString(),
        },
      }), "view");
    },
    [updateActiveRecord],
  );

  const updateActiveContent = useCallback(
    (updater: (content: PlatformContentMap) => PlatformContentMap) => {
      updateActiveRecord((record) => ({
        ...record,
        updatedAt: new Date().toISOString(),
        content: updater(record.content),
      }));
    },
    [updateActiveRecord],
  );

  useDebouncedAutosave({
    value: pendingSaveRecord,
    delay: autosaveDelay,
    enabled: Boolean(pendingSaveRecord),
    onSaving: () =>
      setSaveState((current) =>
        pendingSaveRecord
          ? getVisibleSaveState(current, pendingSaveRecord.source, "saving")
          : current,
      ),
    onSaved: (payload) => {
      setSaveState((current) =>
        getVisibleSaveState(current, payload.source, "saved"),
      );
      setPendingSaveRecord((current) =>
        current?.requestId === payload.requestId ? null : current,
      );
    },
    onError: () => {
      setSaveState((current) =>
        pendingSaveRecord
          ? getVisibleSaveState(current, pendingSaveRecord.source, "error")
          : current,
      );
    },
    save: (payload) => adapter.save(payload.record),
  });

  return {
    loaded,
    records,
    filteredRecords,
    activeRecord,
    activeRecordId,
    searchQuery,
    saveState,
    setSearchQuery,
    createRecord,
    renameRecord,
    deleteRecord,
    selectRecord,
    updateRecord,
    updateActiveRecord,
    updateActiveContent,
    setActivePlatform,
  };
}

function sortRecords(records: HistoryRecord[]) {
  return [...records].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

function getMostRecentlyViewedRecord(records: HistoryRecord[]) {
  return [...records].sort((left, right) =>
    right.workspace.lastViewedAt.localeCompare(left.workspace.lastViewedAt),
  )[0];
}

"use client";

import { useEffect } from "react";

type UseDebouncedAutosaveOptions<T> = {
  value: T | null;
  delay: number;
  enabled?: boolean;
  onSaving: () => void;
  onSaved: (value: T) => void;
  onError: (error: unknown) => void;
  save: (value: T) => Promise<unknown>;
};

export function useDebouncedAutosave<T>({
  value,
  delay,
  enabled = true,
  onSaving,
  onSaved,
  onError,
  save,
}: UseDebouncedAutosaveOptions<T>) {
  useEffect(() => {
    if (!enabled || !value) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      onSaving();

      try {
        await save(value);
        onSaved(value);
      } catch (error) {
        onError(error);
      }
    }, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [delay, enabled, onError, onSaved, onSaving, save, value]);
}

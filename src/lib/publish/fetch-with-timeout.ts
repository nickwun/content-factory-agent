export class FetchTimeoutError extends Error {
  label: string;
  timeoutMs: number;

  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "FetchTimeoutError";
    this.label = label;
    this.timeoutMs = timeoutMs;
  }
}

type FetchWithTimeoutOptions = {
  label: string;
  timeoutMs: number;
};

export async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init: RequestInit,
  options: FetchWithTimeoutOptions,
) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut && isAbortError(error)) {
      throw new FetchTimeoutError(options.label, options.timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

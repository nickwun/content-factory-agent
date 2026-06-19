import type { PublishErrorCode } from "./types.ts";

export class PublishServiceError extends Error {
  code: PublishErrorCode;
  status: number;

  constructor(code: PublishErrorCode, message: string, status = 500) {
    super(message);
    this.name = "PublishServiceError";
    this.code = code;
    this.status = status;
  }
}

export function toPublishErrorResponse(error: unknown) {
  if (error instanceof PublishServiceError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "upstream_publish_failed" as const,
        message: error instanceof Error ? error.message : "Unexpected publish error",
      },
    },
  };
}

import {
  attachPromptPresetCorpusFile,
  listPromptPresetCorpusFiles,
  PromptPresetError,
  replacePromptPresetCorpusFile,
} from "../../../../../lib/settings/prompt-settings-server.ts";
import { parseRewriteCorpusFile } from "../../../../../lib/settings/rewrite-corpus-parser.ts";
import { summarizeRewriteCorpus } from "../../../../../lib/settings/rewrite-corpus-summary.ts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    return Response.json({
      corpusFiles: listPromptPresetCorpusFiles(id),
    });
  } catch (error) {
    return handlePromptPresetCorpusError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const replaceFileId = formData.get("replaceFileId");

    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }

    const parsed = await parseRewriteCorpusFile(file);
    const summary = summarizeRewriteCorpus(parsed.extractedText);

    const corpusFile =
      typeof replaceFileId === "string" && replaceFileId.trim()
        ? replacePromptPresetCorpusFile(id, replaceFileId.trim(), {
            fileName: parsed.fileName,
            mimeType: parsed.mimeType,
            extractedText: parsed.extractedText,
            summary,
          })
        : attachPromptPresetCorpusFile(id, {
            fileName: parsed.fileName,
            mimeType: parsed.mimeType,
            extractedText: parsed.extractedText,
            summary,
          });

    return Response.json({ corpusFile }, { status: 201 });
  } catch (error) {
    return handlePromptPresetCorpusError(error);
  }
}

function handlePromptPresetCorpusError(error: unknown) {
  if (error instanceof PromptPresetError) {
    const status =
      error.code === "preset_not_found" || error.code === "corpus_file_not_found"
        ? 404
        : error.code === "unsupported_corpus_platform"
          ? 400
          : 400;

    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
        },
      },
      { status },
    );
  }

  if (error instanceof Error) {
    return Response.json(
      {
        error: {
          code: "parse_failed",
          message: error.message,
        },
      },
      { status: 400 },
    );
  }

  return Response.json(
    {
      error: {
        code: "unexpected_error",
        message: "Unexpected prompt preset corpus error",
      },
    },
    { status: 500 },
  );
}

import {
  deletePromptPresetCorpusFile,
  PromptPresetError,
} from "../../../../../../lib/settings/prompt-settings-server.ts";

type RouteContext = {
  params: Promise<{
    id: string;
    fileId: string;
  }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  const { id, fileId } = await context.params;

  try {
    deletePromptPresetCorpusFile(id, fileId);
    return Response.json({ success: true });
  } catch (error) {
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
}

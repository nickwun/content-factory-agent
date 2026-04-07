import type {
  XiaohongshuContent,
  XiaohongshuImageSuggestion,
} from "../types/history.ts";

type XiaohongshuImageGenerationResult = {
  imagePrompt: string;
  imageUrl: string;
  imageModel: string;
  generatedAt: string;
};

export function startXiaohongshuImageGeneration(
  content: XiaohongshuContent,
  suggestionId: string,
) {
  return updateSuggestion(content, suggestionId, (suggestion) => {
    assertAllowedTransition(suggestion.status, "generating");

    return {
      ...suggestion,
      status: "generating",
      imageUrl: undefined,
      imageError: undefined,
      imageFailureReason: undefined,
      generatedAt: undefined,
    };
  });
}

export function finishXiaohongshuImageGeneration(
  content: XiaohongshuContent,
  suggestionId: string,
  result: XiaohongshuImageGenerationResult,
) {
  return updateSuggestion(content, suggestionId, (suggestion) => {
    assertAllowedTransition(suggestion.status, "generated");

    return {
      ...suggestion,
      status: "generated",
      imagePrompt: result.imagePrompt,
      imageUrl: result.imageUrl,
      imageModel: result.imageModel,
      generatedAt: result.generatedAt,
      imageError: undefined,
      imageFailureReason: undefined,
    };
  });
}

export function failXiaohongshuImageGeneration(
  content: XiaohongshuContent,
  suggestionId: string,
  failure: {
    imageError: string;
    imageFailureReason?:
      | "failed_ratio_check"
      | "failed_text_ui_check"
      | "failed_upstream_generation";
  },
) {
  return updateSuggestion(content, suggestionId, (suggestion) => {
    assertAllowedTransition(suggestion.status, "failed");

    return {
      ...suggestion,
      status: "failed",
      imageError: failure.imageError,
      imageFailureReason: failure.imageFailureReason,
    };
  });
}

function updateSuggestion(
  content: XiaohongshuContent,
  suggestionId: string,
  updater: (suggestion: XiaohongshuImageSuggestion) => XiaohongshuImageSuggestion,
) {
  return {
    ...content,
    imageSuggestions: content.imageSuggestions.map((suggestion) =>
      suggestion.id === suggestionId ? updater(suggestion) : suggestion,
    ),
  };
}

function assertAllowedTransition(
  currentStatus: XiaohongshuImageSuggestion["status"],
  nextStatus: XiaohongshuImageSuggestion["status"],
) {
  const allowedTransitions: Record<
    XiaohongshuImageSuggestion["status"],
    XiaohongshuImageSuggestion["status"][]
  > = {
    suggested: ["generating"],
    generating: ["generated", "failed"],
    failed: ["generating"],
    generated: ["generating"],
  };

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new Error("Invalid xiaohongshu image state transition");
  }
}

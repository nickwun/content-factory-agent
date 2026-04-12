import type { RewriteSourceRoleHint } from "./rewrite-chunking.ts";

export type RewriteBriefStructureItem = {
  index: number;
  role: RewriteSourceRoleHint;
  summary: string;
  keyPoints: string[];
  transitionToNext?: string;
  emphasis: "low" | "medium" | "high";
};

export type RewriteBrief = {
  version: string;
  sourceStats: {
    totalChars: number;
    totalChunks: number;
    estimatedParagraphGroups: number;
  };
  theme: string;
  coreClaims: string[];
  mustKeepPoints: string[];
  reusableFacts: string[];
  toneProfile: {
    overallTone: string;
    pacing: string;
    rhetoricalMoves: string[];
    emotionalTemperature: string;
  };
  structureFlow: RewriteBriefStructureItem[];
  argumentCadence: {
    openingMove: string;
    progressionPattern: string;
    evidenceStyle: string;
    endingMove: string;
  };
};

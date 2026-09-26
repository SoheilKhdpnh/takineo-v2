import { z } from "zod";

import {
  CORRECTION_TYPES,
  ENGLISH_LEVELS,
  SUGGESTION_KINDS,
  SUGGESTION_PRIORITIES,
  type AnalysisEngineOutput,
} from "@/lib/domain/session-analysis";

const correctionSchema = z.object({
  type: z.enum(CORRECTION_TYPES),
  subtype: z.string().min(1),
  originalText: z.string().min(1),
  correctedText: z.string().min(1),
  explanation: z.string().min(1),
  transcriptSegmentIndex: z.number().int().nonnegative(),
  charStart: z.number().int().nonnegative().nullable().optional().default(null),
  charEnd: z.number().int().nonnegative().nullable().optional().default(null),
  confidence: z.number().gt(0).lte(1),
});

const vocabularyAlternativeSchema = z.object({
  suggestion: z.string().min(1),
  cefrLevel: z.enum(ENGLISH_LEVELS),
  exampleSentence: z.string().min(1).nullable().optional().default(null),
  definitionFa: z.string().min(1).nullable().optional().default(null),
});

const vocabularySchema = z.object({
  headword: z.string().min(1),
  lemma: z.string().min(1).nullable().optional().default(null),
  partOfSpeech: z.string().min(1),
  status: z.enum(["USED_CORRECTLY", "MISUSED", "OVERUSED"]),
  occurrenceCount: z.number().int().positive(),
  cefrLevel: z.enum(ENGLISH_LEVELS).nullable().optional().default(null),
  segmentIndexes: z.array(z.number().int().nonnegative()).min(1),
  exampleExcerpt: z.string().min(1).nullable().optional().default(null),
  confidence: z.number().gt(0).lte(1),
  alternatives: z.array(vocabularyAlternativeSchema).optional().default([]),
});

const suggestionSchema = z.object({
  weakPointKey: z.string().min(1).nullable(),
  priority: z.enum(SUGGESTION_PRIORITIES),
  kind: z.enum(SUGGESTION_KINDS),
  focus: z.string().min(1),
  rationale: z.string().min(1),
  activity: z.string().min(1),
  targetDescription: z.string().min(1),
  targetSubtype: z.string().min(1).nullable(),
  targetMaxOccurrences: z.number().int().nonnegative().nullable(),
  targetLevel: z.enum(ENGLISH_LEVELS).nullable(),
  estimatedMinutes: z.number().int().positive().nullable(),
});

const analysisEngineOutputSchema = z.object({
  overallLevelEstimate: z.enum(ENGLISH_LEVELS).nullable(),
  summaryEn: z.string().min(1),
  summaryFa: z.string().min(1).nullable().optional().default(null),
  corrections: z.array(correctionSchema),
  vocabulary: z.array(vocabularySchema).optional().default([]),
  suggestions: z.array(suggestionSchema).optional().default([]),
  selfCorrectionCount: z.number().int().nonnegative().optional().default(0),
  repetitionCount: z.number().int().nonnegative().optional().default(0),
  abandonedSentenceCount: z.number().int().nonnegative().optional().default(0),
});

export function parseAnalysisEngineOutput(payload: unknown): AnalysisEngineOutput {
  const parsed = analysisEngineOutputSchema.safeParse(payload);
  if (!parsed.success) {
    throw new SyntaxError("Analysis engine output did not match the contract schema.");
  }
  return parsed.data;
}

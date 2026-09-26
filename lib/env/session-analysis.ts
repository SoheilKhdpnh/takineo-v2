import "server-only";

import { z } from "zod";

import type { SessionAnalysisPolicy } from "@/lib/domain/session-analysis";

const positiveInt = z.coerce.number().int().positive();
const unitInterval = z.coerce.number().gt(0).lte(1);

function readRequired<T>(
  name: string,
  schema: z.ZodType<T>,
): T {
  const parsed = schema.safeParse(process.env[name]);
  if (!parsed.success) {
    throw new Error(`Session analysis policy ${name} is not configured.`);
  }
  return parsed.data;
}

export function getSessionAnalysisPolicy(): SessionAnalysisPolicy {
  return {
    minDurationMs: readRequired("SESSION_ANALYSIS_MIN_DURATION_MS", positiveInt),
    maxDurationMs: readRequired("SESSION_ANALYSIS_MAX_DURATION_MS", positiveInt),
    confidenceThreshold: readRequired(
      "SESSION_ANALYSIS_CONFIDENCE_THRESHOLD",
      unitInterval,
    ),
    overuseThreshold: readRequired("SESSION_ANALYSIS_OVERUSE_THRESHOLD", positiveInt),
    weakPointMinimumOccurrences: readRequired(
      "SESSION_ANALYSIS_WEAK_POINT_MIN_OCCURRENCES",
      positiveInt,
    ),
    optionalImprovementCap: readRequired(
      "SESSION_ANALYSIS_OPTIONAL_IMPROVEMENT_CAP",
      z.coerce.number().int().nonnegative(),
    ),
    generalSuggestionCap: readRequired(
      "SESSION_ANALYSIS_GENERAL_SUGGESTION_CAP",
      z.coerce.number().int().nonnegative(),
    ),
    longPauseMs: readRequired("SESSION_ANALYSIS_LONG_PAUSE_MS", positiveInt),
    maxAttempts: readRequired("SESSION_ANALYSIS_MAX_ATTEMPTS", positiveInt),
  };
}

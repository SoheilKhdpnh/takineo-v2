import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { getInternalJobSecret } from "@/lib/env/internal-jobs";
import { getSessionAnalysisPolicy } from "@/lib/env/session-analysis";
import {
  createFakeAnalysisEngine,
  createFakeTranscriptionEngine,
} from "@/lib/session-analysis/fakes";
import { analyzeCompletedSession } from "@/lib/services/session-analysis.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store" };
const jobRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    limit: z.number().int().min(1).max(50).default(1),
  })
  .strict();

function hasValidJobSecret(request: Request) {
  const supplied = request.headers.get("x-takineo-job-secret") ?? "";
  const expected = getInternalJobSecret();
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);

  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

export async function POST(request: Request) {
  try {
    if (!hasValidJobSecret(request)) {
      return Response.json(
        { error: "INTERNAL_JOB_UNAUTHORIZED" },
        { status: 401, headers: privateHeaders },
      );
    }
  } catch {
    return Response.json(
      { error: "INTERNAL_JOB_NOT_CONFIGURED" },
      { status: 503, headers: privateHeaders },
    );
  }

  const parsed = jobRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_REQUEST",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: privateHeaders },
    );
  }

  try {
    const policy = getSessionAnalysisPolicy();
    const result = await analyzeCompletedSession({
      sessionId: parsed.data.sessionId,
      policy,
      transcription: createFakeTranscriptionEngine(),
      analysis: createFakeAnalysisEngine(),
      requestIdempotencyKey: parsed.data.sessionId,
    });

    return Response.json(
      {
        degradations: result.degradations,
        weakPointCount: result.weakPoints.length,
        correctionCount: result.corrections.length,
      },
      { status: 200, headers: privateHeaders },
    );
  } catch {
    return Response.json(
      { error: "SESSION_ANALYSIS_JOB_FAILED" },
      { status: 503, headers: privateHeaders },
    );
  }
}

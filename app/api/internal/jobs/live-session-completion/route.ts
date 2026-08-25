import { timingSafeEqual } from "node:crypto";

import { getInternalJobSecret } from "@/lib/env/internal-jobs";
import {
  processDueLiveSessionCompletions,
} from "@/lib/services/live-session-completion.service";
import {
  liveSessionCompletionJobSchema,
} from "@/lib/validations/live-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store" };

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

  const parsed = liveSessionCompletionJobSchema.safeParse(
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
    const result = await processDueLiveSessionCompletions(
      parsed.data.limit,
      {
        sessionId: parsed.data.sessionId,
      },
    );

    return Response.json(result, {
      status: 200,
      headers: privateHeaders,
    });
  } catch {
    return Response.json(
      { error: "LIVE_SESSION_COMPLETION_JOB_FAILED" },
      { status: 503, headers: privateHeaders },
    );
  }
}

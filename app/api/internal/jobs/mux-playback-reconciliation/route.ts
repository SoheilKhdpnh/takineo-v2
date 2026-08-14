import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { getInternalJobSecret } from "@/lib/env/internal-jobs";
import {
  getMuxPlaybackReconciliationOperationalHealth,
  processDueMuxPlaybackReconciliations,
} from "@/lib/services/mux-playback-reconciliation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store" };
const jobRequestSchema = z
  .object({ limit: z.number().int().min(1).max(50).default(20) })
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
    const result = await processDueMuxPlaybackReconciliations(parsed.data.limit);
    const health = await getMuxPlaybackReconciliationOperationalHealth();

    return Response.json(
      { result, health },
      {
        status: health.status === "DEGRADED" ? 503 : 200,
        headers: privateHeaders,
      },
    );
  } catch {
    return Response.json(
      { error: "MUX_RECONCILIATION_JOB_FAILED" },
      { status: 503, headers: privateHeaders },
    );
  }
}

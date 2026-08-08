import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { getInternalJobSecret } from "@/lib/env/internal-jobs";
import { processDueMuxPlaybackReconciliations } from "@/lib/services/mux-playback-reconciliation.service";

export const runtime = "nodejs";

const jobRequestSchema = z.object({ limit: z.number().int().min(1).max(50).default(20) }).strict();

function hasValidJobSecret(request: Request) {
  const supplied = request.headers.get("x-takineo-job-secret") ?? "";
  const expected = getInternalJobSecret();
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function POST(request: Request) {
  try {
    if (!hasValidJobSecret(request)) return Response.json({ error: "INTERNAL_JOB_UNAUTHORIZED" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "INTERNAL_JOB_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
  const parsed = jobRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten().fieldErrors }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  const result = await processDueMuxPlaybackReconciliations(parsed.data.limit);
  return Response.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
}

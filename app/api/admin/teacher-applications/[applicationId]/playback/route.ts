import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse } from "@/lib/errors/admin-http";
import { createAdminReviewPlayback } from "@/lib/services/admin-review.service";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  if (!hasTrustedRequestOrigin(request)) return Response.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getApiSession(request);
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try { const { applicationId } = await context.params; return Response.json({ playback: await createAdminReviewPlayback(session.user.id, applicationId) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return adminErrorResponse(error); }
}

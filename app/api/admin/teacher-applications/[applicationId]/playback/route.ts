import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse, adminPrivateJson } from "@/lib/errors/admin-http";
import { createAdminReviewPlayback } from "@/lib/services/admin-review.service";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import { adminApplicationIdSchema } from "@/lib/validations/admin-review";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  if (!hasTrustedRequestOrigin(request)) return adminPrivateJson({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getApiSession(request);
  if (!session) return adminPrivateJson({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsedId = adminApplicationIdSchema.safeParse((await context.params).applicationId);
  if (!parsedId.success) return adminPrivateJson({ error: "INVALID_REQUEST", issues: { applicationId: ["Invalid application ID."] } }, { status: 400 });
  try { return adminPrivateJson({ playback: await createAdminReviewPlayback(session.user.id, parsedId.data) }); }
  catch (error) { return adminErrorResponse(error); }
}

import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse } from "@/lib/errors/admin-http";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import { rejectTeacherApplication } from "@/lib/services/admin-review.service";
import { rejectApplicationSchema } from "@/lib/validations/admin-review";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  if (!hasTrustedRequestOrigin(request)) return Response.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getApiSession(request);
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = rejectApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try { const { applicationId } = await context.params; return Response.json({ application: await rejectTeacherApplication(session.user.id, applicationId, parsed.data) }); }
  catch (error) { return adminErrorResponse(error); }
}

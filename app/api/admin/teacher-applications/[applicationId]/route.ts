import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse, adminPrivateJson } from "@/lib/errors/admin-http";
import { getAdminTeacherApplication } from "@/lib/services/admin-review.service";
import { adminApplicationIdSchema } from "@/lib/validations/admin-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const session = await getApiSession(request);
  if (!session) return adminPrivateJson({ error: "UNAUTHORIZED" }, { status: 401 });
  try { await requireAdminAccess(session.user.id); } catch (error) { return adminErrorResponse(error); }
  const parsedId = adminApplicationIdSchema.safeParse((await context.params).applicationId);
  if (!parsedId.success) return adminPrivateJson({ error: "INVALID_REQUEST", issues: { applicationId: ["Invalid application ID."] } }, { status: 400 });
  try { return adminPrivateJson({ application: await getAdminTeacherApplication(session.user.id, parsedId.data) }); }
  catch (error) { return adminErrorResponse(error); }
}

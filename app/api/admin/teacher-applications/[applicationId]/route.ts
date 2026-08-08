import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse } from "@/lib/errors/admin-http";
import { getAdminTeacherApplication } from "@/lib/services/admin-review.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  const session = await getApiSession(request);
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try { const { applicationId } = await context.params; return Response.json({ application: await getAdminTeacherApplication(session.user.id, applicationId) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return adminErrorResponse(error); }
}

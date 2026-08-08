import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse, adminPrivateJson } from "@/lib/errors/admin-http";
import { listPendingTeacherApplications } from "@/lib/services/admin-review.service";
import { adminQueueQuerySchema } from "@/lib/validations/admin-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return adminPrivateJson({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = adminQueueQuerySchema.safeParse({ cursor: url.searchParams.get("cursor") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) return adminPrivateJson({ error: "INVALID_REQUEST", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try { return adminPrivateJson(await listPendingTeacherApplications(session.user.id, parsed.data)); }
  catch (error) { return adminErrorResponse(error); }
}

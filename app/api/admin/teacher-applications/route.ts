import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse } from "@/lib/errors/admin-http";
import { listPendingTeacherApplications } from "@/lib/services/admin-review.service";
import { adminQueueQuerySchema } from "@/lib/validations/admin-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const url = new URL(request.url);
  const parsed = adminQueueQuerySchema.safeParse({ cursor: url.searchParams.get("cursor") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) return Response.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try { return Response.json(await listPendingTeacherApplications(session.user.id, parsed.data), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return adminErrorResponse(error); }
}

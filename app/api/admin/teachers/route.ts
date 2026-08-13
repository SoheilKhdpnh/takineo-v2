import { requireAdminAccess } from "@/lib/auth/admin-access";
import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse, adminPrivateJson } from "@/lib/errors/admin-http";
import { listModeratableTeachers } from "@/lib/services/admin-moderation.service";
import { adminModerationListQuerySchema } from "@/lib/validations/admin-moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return adminPrivateJson({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    await requireAdminAccess(session.user.id, "MODERATE_TEACHER");
  } catch (error) {
    return adminErrorResponse(error);
  }

  const url = new URL(request.url);
  const parsed = adminModerationListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );

  if (!parsed.success) {
    return adminPrivateJson(
      {
        error: "INVALID_REQUEST",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    return adminPrivateJson(
      await listModeratableTeachers(session.user.id, parsed.data),
    );
  } catch (error) {
    return adminErrorResponse(error);
  }
}

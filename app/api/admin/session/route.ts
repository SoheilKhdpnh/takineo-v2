import { getCurrentAdminCapabilities } from "@/lib/auth/admin-access";
import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse, adminPrivateJson } from "@/lib/errors/admin-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return adminPrivateJson({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    return adminPrivateJson({ admin: await getCurrentAdminCapabilities(session.user.id) });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

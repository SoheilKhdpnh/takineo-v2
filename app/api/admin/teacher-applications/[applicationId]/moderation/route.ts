import { getApiSession } from "@/lib/auth/api-session";
import { adminErrorResponse, adminPrivateJson } from "@/lib/errors/admin-http";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import { setTeacherSuspension } from "@/lib/services/admin-review.service";
import { adminApplicationIdSchema, teacherModerationSchema } from "@/lib/validations/admin-review";
import { z } from "zod";

export const runtime = "nodejs";
const schema = teacherModerationSchema.extend({ action: z.enum(["SUSPEND", "REINSTATE"]) });

export async function POST(request: Request, context: { params: Promise<{ applicationId: string }> }) {
  if (!hasTrustedRequestOrigin(request)) return adminPrivateJson({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getApiSession(request);
  if (!session) return adminPrivateJson({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsedId = adminApplicationIdSchema.safeParse((await context.params).applicationId);
  if (!parsedId.success) return adminPrivateJson({ error: "INVALID_REQUEST", issues: { applicationId: ["Invalid application ID."] } }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return adminPrivateJson({ error: "INVALID_REQUEST", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    return adminPrivateJson({ application: await setTeacherSuspension(session.user.id, parsedId.data, parsed.data.action === "SUSPEND", parsed.data) });
  } catch (error) { return adminErrorResponse(error); }
}

import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { getApiSession } from "@/lib/auth/api-session";
import { hasTrustedRequestOrigin } from "@/lib/security/same-origin";
import {
  StudentAiChatUnavailableError,
  StudentAiChatUpstreamError,
  askStudentAiChat,
  isStudentAiChatConfigured,
} from "@/lib/services/student-ai-chat.service";
import { studentAiChatInputSchema } from "@/lib/validations/student-ai-chat";

export const runtime = "nodejs";

function mapError(error: unknown): Response {
  if (error instanceof ProfileRoleMismatchError) {
    return Response.json(
      { error: "FORBIDDEN_PROFILE_TYPE" },
      { status: 403 },
    );
  }

  if (error instanceof ProfileNotFoundError) {
    return Response.json(
      { error: "PROFILE_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (error instanceof StudentAiChatUnavailableError) {
    return Response.json(
      { error: "AI_CHAT_UNAVAILABLE" },
      { status: 503 },
    );
  }

  if (error instanceof StudentAiChatUpstreamError) {
    return Response.json(
      { error: "AI_CHAT_UPSTREAM_ERROR" },
      { status: 502 },
    );
  }

  console.error("Unexpected student AI chat error:", error);

  return Response.json(
    { error: "INTERNAL_SERVER_ERROR" },
    { status: 500 },
  );
}

export async function GET(): Promise<Response> {
  return Response.json({
    available: isStudentAiChatConfigured(),
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedRequestOrigin(request)) {
    return Response.json(
      { error: "UNTRUSTED_ORIGIN" },
      { status: 403 },
    );
  }

  const session = await getApiSession(request);

  if (!session) {
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const validation = studentAiChatInputSchema.safeParse(body);

  if (!validation.success) {
    return Response.json(
      {
        error: "INVALID_REQUEST",
        fields: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const result = await askStudentAiChat(
      session.user.id,
      validation.data,
    );

    return Response.json({ reply: result.reply });
  } catch (error) {
    return mapError(error);
  }
}

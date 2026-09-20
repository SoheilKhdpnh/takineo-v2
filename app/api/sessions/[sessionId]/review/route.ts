import {
  getUserAccessContext,
} from "@/lib/auth/access";
import {
  getApiSession,
} from "@/lib/auth/api-session";
import {
  sessionReviewErrorResponse,
  sessionReviewPrivateJson,
} from "@/lib/errors/session-review-http";
import {
  hasTrustedRequestOrigin,
} from "@/lib/security/same-origin";
import {
  getSessionReviewForStudent,
  submitSessionReview,
} from "@/lib/services/session-review.service";
import {
  liveSessionReadIdSchema,
} from "@/lib/validations/live-session";
import {
  submitSessionReviewBodySchema,
  submitSessionReviewSchema,
} from "@/lib/validations/session-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

function serializeReview(
  review: {
    id: string;
    sessionId: string;
    studentUserId: string;
    teacherUserId: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
  },
) {
  return {
    id: review.id,
    sessionId: review.sessionId,
    studentUserId: review.studentUserId,
    teacherUserId: review.teacherUserId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}

async function requireActiveSession(request: Request): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const session = await getApiSession(request);

  if (!session) {
    return {
      ok: false,
      response: sessionReviewPrivateJson(
        { error: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  const access = await getUserAccessContext(session.user.id);

  if (!access || access.accountStatus !== "ACTIVE") {
    return {
      ok: false,
      response: sessionReviewPrivateJson(
        { error: "UNAUTHORIZED" },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    userId: session.user.id,
  };
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = await requireActiveSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { sessionId } = await context.params;
  const parsedSessionId = liveSessionReadIdSchema.safeParse(sessionId);

  if (!parsedSessionId.success) {
    return sessionReviewPrivateJson(
      { error: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const review = await getSessionReviewForStudent(
      auth.userId,
      parsedSessionId.data,
    );

    return sessionReviewPrivateJson({
      review: review ? serializeReview(review) : null,
    });
  } catch (error) {
    return sessionReviewErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  if (!hasTrustedRequestOrigin(request)) {
    return sessionReviewPrivateJson(
      { error: "UNTRUSTED_ORIGIN" },
      { status: 403 },
    );
  }

  const auth = await requireActiveSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return sessionReviewPrivateJson(
      { error: "INVALID_JSON" },
      { status: 400 },
    );
  }

  const { sessionId } = await context.params;
  const parsedBody = submitSessionReviewBodySchema.safeParse(body);

  if (!parsedBody.success) {
    return sessionReviewPrivateJson(
      {
        error: "INVALID_REQUEST",
        fields: parsedBody.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const parsedInput = submitSessionReviewSchema.safeParse({
    sessionId,
    ...parsedBody.data,
  });

  if (!parsedInput.success) {
    return sessionReviewPrivateJson(
      {
        error: "INVALID_REQUEST",
        fields: parsedInput.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const review = await submitSessionReview(
      auth.userId,
      parsedInput.data,
    );

    return sessionReviewPrivateJson({
      review: serializeReview(review),
    });
  } catch (error) {
    return sessionReviewErrorResponse(error);
  }
}

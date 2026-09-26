import "server-only";

import {
  decideSessionReviewEligibility,
  normalizeSessionReviewComment,
} from "@/lib/domain/session-review-policy";
import {
  prisma,
} from "@/lib/db/prisma";
import {
  SessionReviewAlreadySubmittedError,
  SessionReviewDeniedError,
  SessionReviewTargetNotFoundError,
} from "@/lib/errors/session-review-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  submitSessionReviewSchema,
  type SubmitSessionReviewInput,
} from "@/lib/validations/session-review";

const sessionReviewSelect = {
  id: true,
  sessionId: true,
  studentUserId: true,
  teacherUserId: true,
  rating: true,
  comment: true,
  createdAt: true,
} satisfies Prisma.SessionReviewSelect;

const reviewSessionSelect = {
  id: true,
  status: true,
  startAt: true,
  studentUserId: true,
  teacherProfile: {
    select: {
      userId: true,
    },
  },
} satisfies Prisma.SpeakingSessionSelect;

export type SessionReviewView = {
  id: string;
  sessionId: string;
  studentUserId: string;
  teacherUserId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
};

function toSessionReviewView(
  row: Prisma.SessionReviewGetPayload<{
    select: typeof sessionReviewSelect;
  }>,
): SessionReviewView {
  return {
    id: row.id,
    sessionId: row.sessionId,
    studentUserId: row.studentUserId,
    teacherUserId: row.teacherUserId,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function loadReviewSession(sessionId: string) {
  return prisma.speakingSession.findUnique({
    where: { id: sessionId },
    select: reviewSessionSelect,
  });
}

export async function getSessionReviewForStudent(
  actorUserId: string,
  sessionId: string,
): Promise<SessionReviewView | null> {
  const session = await loadReviewSession(sessionId);

  if (!session) {
    throw new SessionReviewTargetNotFoundError();
  }

  if (session.studentUserId !== actorUserId) {
    throw new SessionReviewDeniedError("NOT_STUDENT");
  }

  const row = await prisma.sessionReview.findUnique({
    where: { sessionId: session.id },
    select: sessionReviewSelect,
  });

  return row ? toSessionReviewView(row) : null;
}

export async function submitSessionReview(
  actorUserId: string,
  input: SubmitSessionReviewInput,
  options: {
    asOf?: Date;
  } = {},
): Promise<SessionReviewView> {
  const parsed = submitSessionReviewSchema.parse(input);
  const asOf = options.asOf ?? new Date();
  const comment = normalizeSessionReviewComment(parsed.comment);

  const session = await loadReviewSession(parsed.sessionId);

  if (!session) {
    throw new SessionReviewTargetNotFoundError();
  }

  const eligibility = decideSessionReviewEligibility({
    actorUserId,
    studentUserId: session.studentUserId,
    status: session.status,
    startAt: session.startAt,
    asOf,
  });

  if (!eligibility.ok) {
    throw new SessionReviewDeniedError(eligibility.reason);
  }

  try {
    const created = await prisma.sessionReview.create({
      data: {
        sessionId: session.id,
        studentUserId: session.studentUserId,
        teacherUserId: session.teacherProfile.userId,
        rating: parsed.rating,
        comment,
      },
      select: sessionReviewSelect,
    });

    return toSessionReviewView(created);
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new SessionReviewAlreadySubmittedError();
    }

    throw error;
  }
}

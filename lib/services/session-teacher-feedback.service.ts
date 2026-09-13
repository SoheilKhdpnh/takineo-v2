import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  SessionAnalysisForbiddenError,
  SessionAnalysisNotFoundError,
} from "@/lib/errors/session-analysis-errors";

/**
 * Teacher judgement is a separate write path from the AI pipeline.
 * analyzeCompletedSession must never call this.
 */
export async function upsertSessionTeacherFeedback(input: {
  sessionId: string;
  authorUserId: string;
  body: string;
  focusNextSession: string | null;
}) {
  const session = await prisma.speakingSession.findUnique({
    where: { id: input.sessionId },
    include: {
      teacherProfile: { select: { userId: true } },
    },
  });

  if (!session) {
    throw new SessionAnalysisNotFoundError();
  }

  if (session.teacherProfile.userId !== input.authorUserId) {
    throw new SessionAnalysisForbiddenError();
  }

  return prisma.speakingSessionTeacherFeedback.upsert({
    where: { sessionId: input.sessionId },
    create: {
      sessionId: input.sessionId,
      authorUserId: input.authorUserId,
      provenance: "TEACHER_JUDGEMENT",
      body: input.body,
      focusNextSession: input.focusNextSession,
    },
    update: {
      body: input.body,
      focusNextSession: input.focusNextSession,
    },
  });
}

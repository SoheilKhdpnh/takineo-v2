import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  assembleSessionAnalysis,
  decideAnalysisEligibility,
  type SessionAnalysisPolicy,
} from "@/lib/domain/session-analysis";
import { SessionAnalysisNotEligibleError } from "@/lib/errors/session-analysis-errors";
import { readVerifiedAudio } from "@/lib/session-analysis/audio-integrity";
import type {
  AnalysisEnginePort,
  AudioStoragePort,
  TranscriptionEnginePort,
} from "@/lib/session-analysis/ports";

type ArtifactWrite = {
  sessionId: string;
  participantRole: "STUDENT" | "TEACHER";
  source: "LIVE_EGRESS" | "SYNTHETIC_FIXTURE" | "OPERATOR_UPLOAD";
  storageProvider: "LOCAL_FILESYSTEM" | "S3_COMPATIBLE";
  storageBucket: string;
  storageKey: string;
  container: "OGG" | "MP4" | "MP3" | "WAV";
  durationMs: number;
  byteSize: number;
  contentSha256: string;
  capturedAt: Date;
};

export async function registerSessionAudioArtifact(input: ArtifactWrite) {
  return prisma.speakingSessionAudioArtifact.upsert({
    where: {
      sessionId_participantRole_contentSha256: {
        sessionId: input.sessionId,
        participantRole: input.participantRole,
        contentSha256: input.contentSha256,
      },
    },
    create: input,
    update: {},
  });
}

export async function analyzeCompletedSession(input: {
  sessionId: string;
  policy: SessionAnalysisPolicy;
  transcription: TranscriptionEnginePort;
  analysis: AnalysisEnginePort;
  storage: AudioStoragePort;
  requestIdempotencyKey: string;
}) {
  const session = await prisma.speakingSession.findUnique({
    where: { id: input.sessionId },
    include: {
      audioArtifacts: true,
      analysisRuns: {
        select: {
          status: true,
          studentAudioArtifactId: true,
          teacherAudioArtifactId: true,
        },
      },
      studentUser: {
        select: {
          studentProfile: { select: { englishLevel: true } },
        },
      },
    },
  });

  if (!session) {
    throw new SessionAnalysisNotEligibleError("SESSION_NOT_COMPLETED");
  }

  const studentArtifact =
    session.audioArtifacts.find((artifact) => artifact.participantRole === "STUDENT") ??
    null;
  const teacherArtifact =
    session.audioArtifacts.find((artifact) => artifact.participantRole === "TEACHER") ??
    null;

  const decision = decideAnalysisEligibility({
    session: { id: session.id, status: session.status },
    studentArtifact,
    teacherArtifact,
    existingRuns: session.analysisRuns,
    policy: input.policy,
  });

  if (!decision.eligible) {
    throw new SessionAnalysisNotEligibleError(decision.reason);
  }

  if (!studentArtifact) {
    throw new SessionAnalysisNotEligibleError("STUDENT_AUDIO_MISSING");
  }

  const studentTrack = await input.transcription.transcribe({
    contentSha256: studentArtifact.contentSha256,
    participantRole: "STUDENT",
    audio: await readVerifiedAudio({
      storage: input.storage,
      ref: studentArtifact,
      contentSha256: studentArtifact.contentSha256,
      byteSize: studentArtifact.byteSize,
    }),
  });
  const teacherTrack = teacherArtifact
    ? await input.transcription.transcribe({
        contentSha256: teacherArtifact.contentSha256,
        participantRole: "TEACHER",
        audio: await readVerifiedAudio({
          storage: input.storage,
          ref: teacherArtifact,
          contentSha256: teacherArtifact.contentSha256,
          byteSize: teacherArtifact.byteSize,
        }),
      })
    : null;
  const tracks = teacherTrack ? [studentTrack, teacherTrack] : [studentTrack];
  const declaredStudentLevel =
    session.studentUser.studentProfile?.englishLevel ?? null;
  const engine = await input.analysis.analyze({
    contentSha256: studentArtifact.contentSha256,
    tracks,
    declaredStudentLevel,
  });

  return assembleSessionAnalysis({
    tracks,
    engine,
    policy: input.policy,
    declaredStudentLevel,
    teacherAudioPresent: Boolean(teacherArtifact),
    studentAudioDurationMs: studentArtifact.durationMs,
  });
}

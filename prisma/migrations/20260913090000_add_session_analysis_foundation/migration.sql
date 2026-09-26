BEGIN;

-- Wave 4 - AI conversation intelligence foundation.
-- Canonical contract: docs/engineering/wave4-ai-pipeline-contract.md
--
-- Additive only: creates new enums and eleven new tables. Alters no Wave 2
-- booking object and no Wave 3 live-session object.
--
-- Generated DDL first, then hand-written constraints the Prisma schema cannot
-- express (contract section 14.2).

-- ===========================================================================
-- Generated: enums
-- ===========================================================================

-- CreateEnum
CREATE TYPE "SpeakingSessionAudioParticipantRole" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "SpeakingSessionAudioSource" AS ENUM ('LIVE_EGRESS', 'SYNTHETIC_FIXTURE', 'OPERATOR_UPLOAD');

-- CreateEnum
CREATE TYPE "SpeakingSessionAudioStorageProvider" AS ENUM ('LOCAL_FILESYSTEM', 'S3_COMPATIBLE');

-- CreateEnum
CREATE TYPE "SpeakingSessionAudioContainer" AS ENUM ('OGG', 'MP4', 'MP3', 'WAV');

-- CreateEnum
CREATE TYPE "SpeakingSessionAnalysisRunStatus" AS ENUM ('QUEUED', 'TRANSCRIBING', 'ANALYZING', 'SUCCEEDED', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SpeakingSessionAnalysisFailureCode" AS ENUM ('AUDIO_UNREADABLE', 'AUDIO_TOO_SHORT', 'TRANSCRIPTION_ENGINE_UNAVAILABLE', 'TRANSCRIPTION_TIMEOUT', 'TRANSCRIPT_EMPTY', 'ANALYSIS_ENGINE_UNAVAILABLE', 'ANALYSIS_TIMEOUT', 'ANALYSIS_OUTPUT_INVALID', 'LEASE_EXPIRED', 'INTERNAL');

-- CreateEnum
CREATE TYPE "SpeakingSessionAnalysisDegradation" AS ENUM ('TEACHER_AUDIO_MISSING', 'LOW_TRANSCRIPT_CONFIDENCE', 'STUDENT_SPEECH_MINIMAL', 'TRUNCATED_TRANSCRIPT', 'STUDENT_LEVEL_UNKNOWN');

-- CreateEnum
CREATE TYPE "SpeakingSessionAnalysisProvenance" AS ENUM ('AI_OBSERVATION', 'AI_RECOMMENDATION', 'TEACHER_JUDGEMENT');

-- CreateEnum
CREATE TYPE "SpeakingSessionCorrectionType" AS ENUM ('GRAMMAR_ERROR', 'LEXICAL_ERROR', 'NATURALNESS', 'OPTIONAL_IMPROVEMENT');

-- CreateEnum
CREATE TYPE "SpeakingSessionVocabularyStatus" AS ENUM ('USED_CORRECTLY', 'MISUSED', 'OVERUSED');

-- CreateEnum
CREATE TYPE "SpeakingSessionPartOfSpeech" AS ENUM ('NOUN', 'VERB', 'ADJECTIVE', 'ADVERB', 'PRONOUN', 'PREPOSITION', 'CONJUNCTION', 'INTERJECTION', 'PHRASAL_VERB', 'COLLOCATION', 'IDIOM', 'OTHER');

-- CreateEnum
CREATE TYPE "SpeakingSessionWeakPointCategory" AS ENUM ('GRAMMAR', 'VOCABULARY', 'PRONUNCIATION', 'FLUENCY', 'DISCOURSE', 'TASK_RESPONSE');

-- CreateEnum
CREATE TYPE "SpeakingSessionWeakPointSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SpeakingSessionSuggestionPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SpeakingSessionSuggestionKind" AS ENUM ('PRACTICE_DRILL', 'PHRASE_SUBSTITUTION', 'PRONUNCIATION_EXERCISE', 'HOMEWORK_TASK', 'RESOURCE');

-- ===========================================================================
-- Generated: tables
-- ===========================================================================

-- CreateTable
CREATE TABLE "speaking_session_audio_artifact" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantRole" "SpeakingSessionAudioParticipantRole" NOT NULL,
    "source" "SpeakingSessionAudioSource" NOT NULL,
    "storageProvider" "SpeakingSessionAudioStorageProvider" NOT NULL,
    "storageBucket" VARCHAR(256) NOT NULL,
    "storageKey" VARCHAR(1024) NOT NULL,
    "container" "SpeakingSessionAudioContainer" NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentSha256" VARCHAR(64) NOT NULL,
    "capturedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_audio_artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_analysis_run" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentAudioArtifactId" TEXT NOT NULL,
    "teacherAudioArtifactId" TEXT,
    "studentAudioRole" "SpeakingSessionAudioParticipantRole" NOT NULL DEFAULT 'STUDENT',
    "teacherAudioRole" "SpeakingSessionAudioParticipantRole",
    "requestIdempotencyKey" VARCHAR(128) NOT NULL,
    "status" "SpeakingSessionAnalysisRunStatus" NOT NULL DEFAULT 'QUEUED',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "degradations" "SpeakingSessionAnalysisDegradation"[],
    "transcriptionEngine" VARCHAR(64),
    "transcriptionModel" VARCHAR(128),
    "analysisEngine" VARCHAR(64),
    "analysisModel" VARCHAR(128),
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "heartbeatAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "failureCode" "SpeakingSessionAnalysisFailureCode",
    "failureDetail" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "speaking_session_analysis_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_transcript" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_OBSERVATION',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "language" VARCHAR(16) NOT NULL,
    "segments" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "studentWordCount" INTEGER NOT NULL,
    "studentSpeakingMs" INTEGER NOT NULL,
    "teacherSpeakingMs" INTEGER,
    "meanStudentConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_analysis_report" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_OBSERVATION',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "overallLevelEstimate" "EnglishLevel",
    "resolvedStudentLevel" "EnglishLevel",
    "summaryEn" VARCHAR(4000) NOT NULL,
    "summaryFa" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_analysis_report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_fluency_profile" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_OBSERVATION',
    "studentSpeakingMs" INTEGER NOT NULL,
    "studentWordCount" INTEGER NOT NULL,
    "studentWordsPerMinute" DOUBLE PRECISION NOT NULL,
    "studentSpeakingRatio" DOUBLE PRECISION,
    "pauseCount" INTEGER NOT NULL,
    "longPauseCount" INTEGER NOT NULL,
    "meanPauseMs" INTEGER,
    "longestPauseMs" INTEGER,
    "fillerWordCount" INTEGER NOT NULL,
    "fillerWordRate" DOUBLE PRECISION NOT NULL,
    "selfCorrectionCount" INTEGER NOT NULL,
    "repetitionCount" INTEGER NOT NULL,
    "abandonedSentenceCount" INTEGER NOT NULL,
    "turnCount" INTEGER,
    "meanStudentTurnMs" INTEGER,
    "longestStudentTurnMs" INTEGER,
    "distinctWordCount" INTEGER NOT NULL,
    "typeTokenRatio" DOUBLE PRECISION,
    "narrativeFeedbackEn" VARCHAR(4000) NOT NULL,
    "narrativeFeedbackFa" VARCHAR(4000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_fluency_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_correction" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_OBSERVATION',
    "type" "SpeakingSessionCorrectionType" NOT NULL,
    "subtype" VARCHAR(64) NOT NULL,
    "originalText" VARCHAR(2000) NOT NULL,
    "correctedText" VARCHAR(2000) NOT NULL,
    "explanation" VARCHAR(2000) NOT NULL,
    "transcriptSegmentIndex" INTEGER NOT NULL,
    "charStart" INTEGER,
    "charEnd" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL,
    "weakPointId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_correction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_vocabulary_observation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_OBSERVATION',
    "headword" VARCHAR(64) NOT NULL,
    "lemma" VARCHAR(64),
    "partOfSpeech" "SpeakingSessionPartOfSpeech" NOT NULL,
    "status" "SpeakingSessionVocabularyStatus" NOT NULL,
    "occurrenceCount" INTEGER NOT NULL,
    "cefrLevel" "EnglishLevel",
    "segmentIndexes" INTEGER[],
    "exampleExcerpt" VARCHAR(2000),
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_vocabulary_observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_vocabulary_alternative" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_RECOMMENDATION',
    "suggestion" VARCHAR(64) NOT NULL,
    "cefrLevel" "EnglishLevel" NOT NULL,
    "maxAllowedLevel" "EnglishLevel" NOT NULL,
    "exampleSentence" VARCHAR(2000),
    "definitionFa" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_vocabulary_alternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_weak_point" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_OBSERVATION',
    "category" "SpeakingSessionWeakPointCategory" NOT NULL,
    "subtype" VARCHAR(64) NOT NULL,
    "severity" "SpeakingSessionWeakPointSeverity" NOT NULL,
    "occurrenceCount" INTEGER NOT NULL,
    "explanation" VARCHAR(2000) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_weak_point_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_suggestion" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'AI_RECOMMENDATION',
    "weakPointId" TEXT,
    "priority" "SpeakingSessionSuggestionPriority" NOT NULL,
    "kind" "SpeakingSessionSuggestionKind" NOT NULL,
    "focus" VARCHAR(256) NOT NULL,
    "rationale" VARCHAR(2000) NOT NULL,
    "activity" VARCHAR(2000) NOT NULL,
    "targetDescription" VARCHAR(500) NOT NULL,
    "targetSubtype" VARCHAR(64),
    "targetMaxOccurrences" INTEGER,
    "targetLevel" "EnglishLevel",
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speaking_session_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speaking_session_teacher_feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "provenance" "SpeakingSessionAnalysisProvenance" NOT NULL DEFAULT 'TEACHER_JUDGEMENT',
    "body" VARCHAR(4000) NOT NULL,
    "focusNextSession" VARCHAR(1000),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "speaking_session_teacher_feedback_pkey" PRIMARY KEY ("id")
);

-- ===========================================================================
-- Generated: indexes
-- ===========================================================================

-- CreateIndex
CREATE INDEX "ss_audio_artifact_session_role_idx" ON "speaking_session_audio_artifact"("sessionId", "participantRole", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ss_audio_artifact_session_role_sha_key" ON "speaking_session_audio_artifact"("sessionId", "participantRole", "contentSha256");

-- CreateIndex
CREATE UNIQUE INDEX "ss_audio_artifact_object_key" ON "speaking_session_audio_artifact"("storageProvider", "storageBucket", "storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ss_audio_artifact_pairing_key" ON "speaking_session_audio_artifact"("id", "sessionId", "participantRole");

-- CreateIndex
CREATE INDEX "ss_analysis_run_session_status_idx" ON "speaking_session_analysis_run"("sessionId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ss_analysis_run_lease_idx" ON "speaking_session_analysis_run"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "ss_analysis_run_session_finished_idx" ON "speaking_session_analysis_run"("sessionId", "finishedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ss_analysis_run_idempotency_key" ON "speaking_session_analysis_run"("studentAudioArtifactId", "requestIdempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_session_transcript_runId_key" ON "speaking_session_transcript"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_session_analysis_report_runId_key" ON "speaking_session_analysis_report"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_session_fluency_profile_runId_key" ON "speaking_session_fluency_profile"("runId");

-- CreateIndex
CREATE INDEX "ss_correction_run_type_idx" ON "speaking_session_correction"("runId", "type");

-- CreateIndex
CREATE INDEX "ss_correction_weak_point_idx" ON "speaking_session_correction"("weakPointId");

-- CreateIndex
CREATE INDEX "ss_correction_run_subtype_idx" ON "speaking_session_correction"("runId", "subtype");

-- CreateIndex
CREATE UNIQUE INDEX "ss_correction_run_rank_key" ON "speaking_session_correction"("runId", "rank");

-- CreateIndex
CREATE INDEX "ss_vocabulary_observation_run_status_idx" ON "speaking_session_vocabulary_observation"("runId", "status");

-- CreateIndex
CREATE INDEX "ss_vocabulary_observation_headword_idx" ON "speaking_session_vocabulary_observation"("headword");

-- CreateIndex
CREATE UNIQUE INDEX "ss_vocabulary_observation_run_headword_key" ON "speaking_session_vocabulary_observation"("runId", "headword");

-- CreateIndex
CREATE UNIQUE INDEX "ss_vocabulary_observation_run_rank_key" ON "speaking_session_vocabulary_observation"("runId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ss_vocabulary_alternative_rank_key" ON "speaking_session_vocabulary_alternative"("observationId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ss_vocabulary_alternative_suggestion_key" ON "speaking_session_vocabulary_alternative"("observationId", "suggestion");

-- CreateIndex
CREATE INDEX "ss_weak_point_run_severity_idx" ON "speaking_session_weak_point"("runId", "severity");

-- CreateIndex
CREATE INDEX "ss_weak_point_category_subtype_idx" ON "speaking_session_weak_point"("category", "subtype");

-- CreateIndex
CREATE UNIQUE INDEX "ss_weak_point_run_rank_key" ON "speaking_session_weak_point"("runId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ss_weak_point_run_subtype_key" ON "speaking_session_weak_point"("runId", "category", "subtype");

-- CreateIndex
CREATE INDEX "ss_suggestion_run_priority_idx" ON "speaking_session_suggestion"("runId", "priority");

-- CreateIndex
CREATE INDEX "ss_suggestion_weak_point_idx" ON "speaking_session_suggestion"("weakPointId");

-- CreateIndex
CREATE UNIQUE INDEX "ss_suggestion_run_rank_key" ON "speaking_session_suggestion"("runId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "speaking_session_teacher_feedback_sessionId_key" ON "speaking_session_teacher_feedback"("sessionId");

-- CreateIndex
CREATE INDEX "ss_teacher_feedback_author_idx" ON "speaking_session_teacher_feedback"("authorUserId", "createdAt");

-- ===========================================================================
-- Generated: foreign keys
-- ===========================================================================

-- AddForeignKey
ALTER TABLE "speaking_session_audio_artifact" ADD CONSTRAINT "speaking_session_audio_artifact_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "speaking_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_analysis_run" ADD CONSTRAINT "speaking_session_analysis_run_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "speaking_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_analysis_run" ADD CONSTRAINT "speaking_session_analysis_run_studentAudioArtifactId_fkey" FOREIGN KEY ("studentAudioArtifactId") REFERENCES "speaking_session_audio_artifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_analysis_run" ADD CONSTRAINT "speaking_session_analysis_run_teacherAudioArtifactId_fkey" FOREIGN KEY ("teacherAudioArtifactId") REFERENCES "speaking_session_audio_artifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_transcript" ADD CONSTRAINT "speaking_session_transcript_runId_fkey" FOREIGN KEY ("runId") REFERENCES "speaking_session_analysis_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_analysis_report" ADD CONSTRAINT "speaking_session_analysis_report_runId_fkey" FOREIGN KEY ("runId") REFERENCES "speaking_session_analysis_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_fluency_profile" ADD CONSTRAINT "speaking_session_fluency_profile_runId_fkey" FOREIGN KEY ("runId") REFERENCES "speaking_session_analysis_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_correction" ADD CONSTRAINT "speaking_session_correction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "speaking_session_analysis_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_correction" ADD CONSTRAINT "speaking_session_correction_weakPointId_fkey" FOREIGN KEY ("weakPointId") REFERENCES "speaking_session_weak_point"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_vocabulary_observation" ADD CONSTRAINT "speaking_session_vocabulary_observation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "speaking_session_analysis_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_vocabulary_alternative" ADD CONSTRAINT "speaking_session_vocabulary_alternative_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "speaking_session_vocabulary_observation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_weak_point" ADD CONSTRAINT "speaking_session_weak_point_runId_fkey" FOREIGN KEY ("runId") REFERENCES "speaking_session_analysis_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_suggestion" ADD CONSTRAINT "speaking_session_suggestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "speaking_session_analysis_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_suggestion" ADD CONSTRAINT "speaking_session_suggestion_weakPointId_fkey" FOREIGN KEY ("weakPointId") REFERENCES "speaking_session_weak_point"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_teacher_feedback" ADD CONSTRAINT "speaking_session_teacher_feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "speaking_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speaking_session_teacher_feedback" ADD CONSTRAINT "speaking_session_teacher_feedback_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===========================================================================
-- Hand-written: constraints the Prisma schema cannot express.
-- Contract section 14.2. prisma migrate diff does NOT report these as drift,
-- so each is covered by an integration test asserting it rejects a bad row.
-- ===========================================================================

-- Contract 13.3: at most one non-terminal run per session. The database, not
-- the application, is the barrier against two workers processing one session.
CREATE UNIQUE INDEX "ss_analysis_run_active_session_key"
  ON "speaking_session_analysis_run" ("sessionId")
  WHERE "status" IN ('QUEUED', 'TRANSCRIBING', 'ANALYZING');

-- Contract 14.1: pin the role discriminators, then use them in composite
-- foreign keys so a cross-session or wrong-role pairing is impossible.
ALTER TABLE "speaking_session_analysis_run"
  ADD CONSTRAINT "ss_analysis_run_student_role_check"
  CHECK ("studentAudioRole" = 'STUDENT');

ALTER TABLE "speaking_session_analysis_run"
  ADD CONSTRAINT "ss_analysis_run_teacher_role_check"
  CHECK (
    ("teacherAudioArtifactId" IS NULL AND "teacherAudioRole" IS NULL)
    OR ("teacherAudioArtifactId" IS NOT NULL AND "teacherAudioRole" = 'TEACHER')
  );

ALTER TABLE "speaking_session_analysis_run"
  ADD CONSTRAINT "ss_analysis_run_student_artifact_pair_fk"
  FOREIGN KEY ("studentAudioArtifactId", "sessionId", "studentAudioRole")
  REFERENCES "speaking_session_audio_artifact" ("id", "sessionId", "participantRole")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- MATCH SIMPLE leaves this key unenforced while the teacher id is NULL, which
-- is the intended optional-teacher-track behaviour (contract 4.2).
ALTER TABLE "speaking_session_analysis_run"
  ADD CONSTRAINT "ss_analysis_run_teacher_artifact_pair_fk"
  FOREIGN KEY ("teacherAudioArtifactId", "sessionId", "teacherAudioRole")
  REFERENCES "speaking_session_audio_artifact" ("id", "sessionId", "participantRole")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contract 13.4: terminal runs are finished, and carry a failure code only
-- when they actually failed; non-terminal runs carry neither.
ALTER TABLE "speaking_session_analysis_run"
  ADD CONSTRAINT "ss_analysis_run_terminal_shape_check"
  CHECK (
    ("status" IN ('SUCCEEDED', 'FAILED', 'ABANDONED')) = ("finishedAt" IS NOT NULL)
  );

ALTER TABLE "speaking_session_analysis_run"
  ADD CONSTRAINT "ss_analysis_run_failure_code_check"
  CHECK (
    ("status" IN ('FAILED', 'ABANDONED')) = ("failureCode" IS NOT NULL)
  );

ALTER TABLE "speaking_session_analysis_run"
  ADD CONSTRAINT "ss_analysis_run_attempt_check"
  CHECK ("attempt" >= 1);

-- Contract 4.1: artifact integrity and plausibility.
ALTER TABLE "speaking_session_audio_artifact"
  ADD CONSTRAINT "ss_audio_artifact_sha256_format_check"
  CHECK ("contentSha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "speaking_session_audio_artifact"
  ADD CONSTRAINT "ss_audio_artifact_positive_metrics_check"
  CHECK ("durationMs" > 0 AND "byteSize" > 0);

ALTER TABLE "speaking_session_audio_artifact"
  ADD CONSTRAINT "ss_audio_artifact_reference_format_check"
  CHECK (
    btrim("storageBucket") = "storageBucket" AND length("storageBucket") > 0
    AND btrim("storageKey") = "storageKey" AND length("storageKey") > 0
  );

-- Contract 3.1: provenance is pinned per table so a row can never claim a
-- layer its table does not represent. Observations first.
ALTER TABLE "speaking_session_transcript"
  ADD CONSTRAINT "ss_transcript_provenance_check"
  CHECK ("provenance" = 'AI_OBSERVATION');

ALTER TABLE "speaking_session_analysis_report"
  ADD CONSTRAINT "ss_report_provenance_check"
  CHECK ("provenance" = 'AI_OBSERVATION');

ALTER TABLE "speaking_session_fluency_profile"
  ADD CONSTRAINT "ss_fluency_provenance_check"
  CHECK ("provenance" = 'AI_OBSERVATION');

ALTER TABLE "speaking_session_correction"
  ADD CONSTRAINT "ss_correction_provenance_check"
  CHECK ("provenance" = 'AI_OBSERVATION');

ALTER TABLE "speaking_session_vocabulary_observation"
  ADD CONSTRAINT "ss_vocabulary_observation_provenance_check"
  CHECK ("provenance" = 'AI_OBSERVATION');

ALTER TABLE "speaking_session_weak_point"
  ADD CONSTRAINT "ss_weak_point_provenance_check"
  CHECK ("provenance" = 'AI_OBSERVATION');

-- Recommendations.
ALTER TABLE "speaking_session_vocabulary_alternative"
  ADD CONSTRAINT "ss_vocabulary_alternative_provenance_check"
  CHECK ("provenance" = 'AI_RECOMMENDATION');

ALTER TABLE "speaking_session_suggestion"
  ADD CONSTRAINT "ss_suggestion_provenance_check"
  CHECK ("provenance" = 'AI_RECOMMENDATION');

-- Teacher judgement.
ALTER TABLE "speaking_session_teacher_feedback"
  ADD CONSTRAINT "ss_teacher_feedback_provenance_check"
  CHECK ("provenance" = 'TEACHER_JUDGEMENT');

ALTER TABLE "speaking_session_teacher_feedback"
  ADD CONSTRAINT "ss_teacher_feedback_body_check"
  CHECK (length(btrim("body")) > 0);

-- Contract 6.2: a correction that changes nothing is not a correction.
ALTER TABLE "speaking_session_correction"
  ADD CONSTRAINT "ss_correction_distinct_text_check"
  CHECK (btrim("originalText") <> btrim("correctedText"));

ALTER TABLE "speaking_session_correction"
  ADD CONSTRAINT "ss_correction_segment_index_check"
  CHECK ("transcriptSegmentIndex" >= 0);

ALTER TABLE "speaking_session_correction"
  ADD CONSTRAINT "ss_correction_char_span_check"
  CHECK (
    ("charStart" IS NULL AND "charEnd" IS NULL)
    OR ("charStart" IS NOT NULL AND "charEnd" IS NOT NULL
        AND "charStart" >= 0 AND "charEnd" > "charStart")
  );

-- Contract 7.4: the level gate. Enum comparison follows PostgreSQL declaration
-- order, and EnglishLevel is declared ascending A1..C2, so this rejects any
-- alternative pitched above the student's resolved level plus one band.
ALTER TABLE "speaking_session_vocabulary_alternative"
  ADD CONSTRAINT "ss_vocabulary_alternative_level_check"
  CHECK ("cefrLevel" <= "maxAllowedLevel");

-- Contract 9.1/9.2: observations and patterns are counted, never zero.
ALTER TABLE "speaking_session_vocabulary_observation"
  ADD CONSTRAINT "ss_vocabulary_observation_occurrence_check"
  CHECK ("occurrenceCount" >= 1);

ALTER TABLE "speaking_session_weak_point"
  ADD CONSTRAINT "ss_weak_point_occurrence_check"
  CHECK ("occurrenceCount" >= 1);

-- Contract 10.1: advice must state why, and what to do.
ALTER TABLE "speaking_session_suggestion"
  ADD CONSTRAINT "ss_suggestion_rationale_present_check"
  CHECK (length(btrim("rationale")) > 0 AND length(btrim("activity")) > 0);

ALTER TABLE "speaking_session_suggestion"
  ADD CONSTRAINT "ss_suggestion_target_shape_check"
  CHECK ("targetMaxOccurrences" IS NULL OR "targetMaxOccurrences" >= 0);

-- Confidence is a probability everywhere it appears.
ALTER TABLE "speaking_session_correction"
  ADD CONSTRAINT "ss_correction_confidence_range_check"
  CHECK ("confidence" >= 0 AND "confidence" <= 1);

ALTER TABLE "speaking_session_vocabulary_observation"
  ADD CONSTRAINT "ss_vocabulary_observation_confidence_range_check"
  CHECK ("confidence" >= 0 AND "confidence" <= 1);

ALTER TABLE "speaking_session_weak_point"
  ADD CONSTRAINT "ss_weak_point_confidence_range_check"
  CHECK ("confidence" >= 0 AND "confidence" <= 1);

ALTER TABLE "speaking_session_transcript"
  ADD CONSTRAINT "ss_transcript_confidence_range_check"
  CHECK (
    "meanStudentConfidence" IS NULL
    OR ("meanStudentConfidence" >= 0 AND "meanStudentConfidence" <= 1)
  );

-- Contract 8: measured quantities are non-negative and ratios are fractions.
ALTER TABLE "speaking_session_fluency_profile"
  ADD CONSTRAINT "ss_fluency_non_negative_check"
  CHECK (
    "studentSpeakingMs" >= 0
    AND "studentWordCount" >= 0
    AND "studentWordsPerMinute" >= 0
    AND "pauseCount" >= 0
    AND "longPauseCount" >= 0
    AND "fillerWordCount" >= 0
    AND "fillerWordRate" >= 0
    AND "selfCorrectionCount" >= 0
    AND "repetitionCount" >= 0
    AND "abandonedSentenceCount" >= 0
    AND "distinctWordCount" >= 0
  );

ALTER TABLE "speaking_session_fluency_profile"
  ADD CONSTRAINT "ss_fluency_ratio_range_check"
  CHECK (
    ("studentSpeakingRatio" IS NULL
      OR ("studentSpeakingRatio" >= 0 AND "studentSpeakingRatio" <= 1))
    AND ("typeTokenRatio" IS NULL
      OR ("typeTokenRatio" >= 0 AND "typeTokenRatio" <= 1))
  );

ALTER TABLE "speaking_session_fluency_profile"
  ADD CONSTRAINT "ss_fluency_long_pause_subset_check"
  CHECK ("longPauseCount" <= "pauseCount");

ALTER TABLE "speaking_session_transcript"
  ADD CONSTRAINT "ss_transcript_non_negative_check"
  CHECK (
    "studentWordCount" >= 0
    AND "studentSpeakingMs" >= 0
    AND ("teacherSpeakingMs" IS NULL OR "teacherSpeakingMs" >= 0)
    AND "schemaVersion" >= 1
  );

COMMIT;

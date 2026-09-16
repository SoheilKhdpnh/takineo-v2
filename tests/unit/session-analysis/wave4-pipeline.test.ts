import { describe, expect, it } from "vitest";

import {
  assembleSessionAnalysis,
  bandConfidence,
  composeSessionLearningReport,
  decideAnalysisEligibility,
  isErrorCorrectionType,
  isRetryableFailureCode,
  measureStudentPauses,
  resolveWeakPointSubtype,
  transcriptReuseKey,
  type SessionAnalysisPolicy,
} from "@/lib/domain/session-analysis";
import {
  REVIEW_FIXTURE_POLICY,
  REVIEW_STUDENT_SHA256,
  REVIEW_STUDENT_WAV,
  reviewFixtureEngineOutput,
  reviewFixtureTracks,
} from "@/lib/session-analysis/fixture";

const policy: SessionAnalysisPolicy = REVIEW_FIXTURE_POLICY;

function completedSession() {
  return { id: "session-1", status: "COMPLETED" as const };
}

function artifact(
  role: "STUDENT" | "TEACHER",
  overrides: Partial<{
    sessionId: string;
    durationMs: number;
    storageKey: string;
  }> = {},
) {
  return {
    id: `${role.toLowerCase()}-audio`,
    sessionId: overrides.sessionId ?? "session-1",
    participantRole: role,
    storageKey: overrides.storageKey ?? `${role.toLowerCase()}.wav`,
    durationMs: overrides.durationMs ?? 12_000,
    contentSha256: "a".repeat(64),
    capturedAt: new Date("2026-09-13T08:00:00.000Z"),
  };
}

describe("Wave 4 session-analysis pipeline", () => {
  it("turns the review fixture into corrections, one past-tense weak point, and no singleton preposition pattern", () => {
    const assembled = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine: reviewFixtureEngineOutput(),
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });

    const grammar = assembled.corrections.filter(
      (item) => item.type === "GRAMMAR_ERROR",
    );
    const lexical = assembled.corrections.filter(
      (item) => item.type === "LEXICAL_ERROR",
    );

    expect(grammar).toHaveLength(2);
    expect(grammar.map((item) => item.correctedText)).toEqual(["I went", "I met"]);
    expect(lexical).toHaveLength(1);
    expect(lexical[0]?.originalText).toBe("discuss about");
    expect(lexical[0]?.correctedText).toBe("discussed");

    expect(
      assembled.corrections.some((item) => item.type === "NATURALNESS"),
    ).toBe(true);
    expect(
      assembled.corrections.filter((item) => item.type === "OPTIONAL_IMPROVEMENT"),
    ).toHaveLength(1);

    expect(assembled.weakPoints).toHaveLength(1);
    expect(assembled.weakPoints[0]).toMatchObject({
      category: "GRAMMAR",
      subtype: "PAST_SIMPLE",
      occurrenceCount: 2,
      provenance: "AI_OBSERVATION",
    });
    expect(
      assembled.weakPoints.some((point) => point.subtype === "PREPOSITION"),
    ).toBe(false);

    expect(assembled.suggestions[0]).toMatchObject({
      provenance: "AI_RECOMMENDATION",
      weakPointKey: "GRAMMAR:PAST_SIMPLE",
      focus: "Past simple vs present simple",
      targetMaxOccurrences: 1,
    });

    const alternatives = assembled.vocabulary[0]?.alternatives ?? [];
    expect(alternatives.map((item) => item.suggestion)).toEqual(["effective"]);
    expect(alternatives.every((item) => item.cefrLevel !== "C1")).toBe(true);
    expect(alternatives[0]?.provenance).toBe("AI_RECOMMENDATION");
    expect(assembled.vocabulary[0]?.provenance).toBe("AI_OBSERVATION");
  });

  it("splits a merged PAST_SIMPLE citation into one occurrence per verb so the weak-point threshold can fire", () => {
    const engine = reviewFixtureEngineOutput();
    engine.corrections = [
      {
        type: "GRAMMAR_ERROR",
        subtype: "PAST_SIMPLE",
        originalText:
          "Yesterday I go to the university and I meet my friend.",
        correctedText:
          "Yesterday I went to the university and I met my friend.",
        explanation: "The verb 'go' should be 'went' in the past tense.",
        transcriptSegmentIndex: 0,
        charStart: null,
        charEnd: null,
        confidence: 0.9,
      },
      {
        type: "LEXICAL_ERROR",
        subtype: "OTHER",
        originalText: "We discuss about our project.",
        correctedText: "We discussed our project.",
        explanation: "The verb 'discuss' should be in the past tense 'discussed'.",
        transcriptSegmentIndex: 2,
        charStart: null,
        charEnd: null,
        confidence: 0.88,
      },
    ];

    const assembled = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine,
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });

    const grammar = assembled.corrections.filter(
      (item) => item.type === "GRAMMAR_ERROR",
    );
    const lexical = assembled.corrections.filter(
      (item) => item.type === "LEXICAL_ERROR",
    );

    expect(grammar).toHaveLength(2);
    expect(grammar.map((item) => item.originalText)).toEqual(["go", "meet"]);
    expect(grammar.map((item) => item.correctedText)).toEqual(["went", "met"]);
    expect(lexical).toHaveLength(1);
    expect(lexical[0]?.originalText).toBe("We discuss about our project.");
    expect(lexical[0]?.correctedText).toBe("We discussed our project.");
    expect(assembled.weakPoints).toHaveLength(1);
    expect(assembled.weakPoints[0]).toMatchObject({
      category: "GRAMMAR",
      subtype: "PAST_SIMPLE",
      occurrenceCount: 2,
    });
  });

  it("rejects an error citation that cannot be mapped to exactly one span", () => {
    const engine = reviewFixtureEngineOutput();
    engine.corrections = [
      {
        type: "GRAMMAR_ERROR",
        subtype: "PAST_SIMPLE",
        originalText: "I",
        correctedText: "I'd",
        explanation: "Ambiguous pronoun occurrence.",
        transcriptSegmentIndex: 0,
        charStart: null,
        charEnd: null,
        confidence: 0.9,
      },
    ];

    const assembled = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine,
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });

    expect(assembled.corrections).toEqual([]);
    expect(assembled.weakPoints).toEqual([]);
  });

  it("drops an identical overlapping error silently and flags a conflicting overlap as a degradation", () => {
    const engine = reviewFixtureEngineOutput();
    const go: (typeof engine.corrections)[number] = {
      type: "GRAMMAR_ERROR",
      subtype: "PAST_SIMPLE",
      originalText: "go",
      correctedText: "went",
      explanation: "Past tense.",
      transcriptSegmentIndex: 0,
      charStart: null,
      charEnd: null,
      confidence: 0.9,
    };
    engine.corrections = [
      go,
      { ...go, explanation: "Repeated identical citation." },
      {
        ...go,
        type: "LEXICAL_ERROR",
        subtype: "PREPOSITION",
        correctedText: "goes",
        explanation: "Conflicting rewrite of the same span.",
      },
    ];

    const assembled = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine,
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });

    const grammar = assembled.corrections.filter(
      (item) => item.type === "GRAMMAR_ERROR",
    );
    expect(grammar).toHaveLength(1);
    expect(grammar[0]?.correctedText).toBe("went");
    expect(assembled.degradations).toContain("OVERLAPPING_ERROR_CITATIONS");
  });

  it("keeps AI observations, AI recommendations, and teacher judgement as separate layers", () => {
    const analysis = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine: reviewFixtureEngineOutput(),
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });
    const report = composeSessionLearningReport({
      sessionId: "session-1",
      analysis,
      teacherFeedback: {
        provenance: "TEACHER_JUDGEMENT",
        body: "Focus on spontaneous storytelling next lesson.",
        focusNextSession: "storytelling",
      },
    });

    expect(report.layers.aiObservations.weakPoints[0]?.subtype).toBe("PAST_SIMPLE");
    expect(report.layers.aiRecommendations.suggestions[0]?.activity).toContain(
      "past-tense",
    );
    expect(report.layers.teacherJudgement?.body).toContain("storytelling");
    expect(report.layers.teacherJudgement?.provenance).toBe("TEACHER_JUDGEMENT");
  });

  it("rejects a cancelled session before considering audio problems", () => {
    expect(
      decideAnalysisEligibility({
        session: { id: "session-1", status: "CANCELLED" },
        studentArtifact: null,
        teacherArtifact: null,
        existingRuns: [],
        policy,
      }),
    ).toEqual({ eligible: false, reason: "SESSION_CANCELLED" });
  });

  it("never analyzes a scheduled session", () => {
    expect(
      decideAnalysisEligibility({
        session: { id: "session-1", status: "SCHEDULED" },
        studentArtifact: artifact("STUDENT"),
        teacherArtifact: artifact("TEACHER"),
        existingRuns: [],
        policy,
      }),
    ).toEqual({ eligible: false, reason: "SESSION_NOT_COMPLETED" });
  });

  it("requires student audio and allows a missing teacher track", () => {
    expect(
      decideAnalysisEligibility({
        session: completedSession(),
        studentArtifact: null,
        teacherArtifact: artifact("TEACHER"),
        existingRuns: [],
        policy,
      }),
    ).toEqual({ eligible: false, reason: "STUDENT_AUDIO_MISSING" });

    expect(
      decideAnalysisEligibility({
        session: completedSession(),
        studentArtifact: artifact("STUDENT"),
        teacherArtifact: null,
        existingRuns: [],
        policy,
      }),
    ).toEqual({ eligible: true });
  });

  it("reports a role mismatch before duration problems", () => {
    expect(
      decideAnalysisEligibility({
        session: completedSession(),
        studentArtifact: artifact("TEACHER"),
        teacherArtifact: null,
        existingRuns: [],
        policy,
      }),
    ).toEqual({ eligible: false, reason: "ARTIFACT_ROLE_MISMATCH" });
  });

  it("rejects implausible durations and already-analyzed pairs", () => {
    expect(
      decideAnalysisEligibility({
        session: completedSession(),
        studentArtifact: artifact("STUDENT", { durationMs: 30 }),
        teacherArtifact: null,
        existingRuns: [],
        policy,
      }),
    ).toEqual({ eligible: false, reason: "ARTIFACT_IMPLAUSIBLE_DURATION" });

    expect(
      decideAnalysisEligibility({
        session: completedSession(),
        studentArtifact: artifact("STUDENT"),
        teacherArtifact: null,
        existingRuns: [
          {
            status: "SUCCEEDED",
            studentAudioArtifactId: "student-audio",
            teacherAudioArtifactId: null,
          },
        ],
        policy,
      }),
    ).toEqual({ eligible: false, reason: "ALREADY_ANALYZED" });
  });

  it("blocks a second in-flight run for the same session", () => {
    expect(
      decideAnalysisEligibility({
        session: completedSession(),
        studentArtifact: artifact("STUDENT"),
        teacherArtifact: null,
        existingRuns: [
          {
            status: "TRANSCRIBING",
            studentAudioArtifactId: "other",
            teacherAudioArtifactId: null,
          },
        ],
        policy,
      }),
    ).toEqual({ eligible: false, reason: "RUN_IN_FLIGHT" });
  });

  it("raises on structurally invalid artifacts", () => {
    expect(() =>
      decideAnalysisEligibility({
        session: completedSession(),
        studentArtifact: artifact("STUDENT", { storageKey: "  padded.wav" }),
        teacherArtifact: null,
        existingRuns: [],
        policy,
      }),
    ).toThrow(RangeError);
  });

  it("does not count teacher floor time as a student pause", () => {
    const transcript = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine: reviewFixtureEngineOutput(),
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    }).transcript;

    const pauses = measureStudentPauses(transcript, 1_500);
    const rawGap = 8_000 - 6_000;
    expect(rawGap).toBe(2_000);
    expect(pauses.durationsMs.every((duration) => duration < rawGap)).toBe(true);
    expect(pauses.longPauseCount).toBe(0);
  });

  it("nulls turn metrics when teacher audio is missing instead of inventing zeros", () => {
    const assembled = assembleSessionAnalysis({
      tracks: reviewFixtureTracks().filter((track) => track.participantRole === "STUDENT"),
      engine: reviewFixtureEngineOutput(),
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: false,
      studentAudioDurationMs: 12_000,
    });

    expect(assembled.degradations).toContain("TEACHER_AUDIO_MISSING");
    expect(assembled.fluency.turnCount).toBeNull();
    expect(assembled.fluency.meanStudentTurnMs).toBeNull();
    expect(assembled.fluency.studentSpeakingRatio).toBeNull();
    expect(assembled.fluency).not.toHaveProperty("fluencyScore");
  });

  it("maps unknown subtypes onto OTHER and never persists free text", () => {
    expect(resolveWeakPointSubtype("GRAMMAR", "PAST_SIMPLE")).toBe("PAST_SIMPLE");
    expect(resolveWeakPointSubtype("GRAMMAR", "past tense")).toBe("OTHER");
    expect(resolveWeakPointSubtype("GRAMMAR", "whatever the model invented")).toBe(
      "OTHER",
    );
  });

  it("never lets two unrelated OTHER fallbacks become a weak-point pattern", () => {
    const engine = reviewFixtureEngineOutput();
    engine.corrections = [
      {
        type: "GRAMMAR_ERROR",
        subtype: "invented-article-rule",
        originalText: "the university",
        correctedText: "university",
        explanation: "Unrelated fallback A.",
        transcriptSegmentIndex: 0,
        charStart: null,
        charEnd: null,
        confidence: 0.9,
      },
      {
        type: "GRAMMAR_ERROR",
        subtype: "invented-clause-rule",
        originalText: "our project",
        correctedText: "the project",
        explanation: "Unrelated fallback B.",
        transcriptSegmentIndex: 2,
        charStart: null,
        charEnd: null,
        confidence: 0.88,
      },
    ];

    const assembled = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine,
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });

    const other = assembled.corrections.filter((item) => item.subtype === "OTHER");
    expect(other).toHaveLength(2);
    expect(other.every((item) => item.weakPointKey === null)).toBe(true);
    expect(
      assembled.weakPoints.some((point) => point.subtype === "OTHER"),
    ).toBe(false);
    expect(assembled.weakPoints).toEqual([]);
  });

  it("suppresses vocabulary alternatives when the student level is unknown", () => {
    const assembled = assembleSessionAnalysis({
      tracks: reviewFixtureTracks(),
      engine: { ...reviewFixtureEngineOutput(), overallLevelEstimate: null },
      policy,
      declaredStudentLevel: null,
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });

    expect(assembled.degradations).toContain("STUDENT_LEVEL_UNKNOWN");
    expect(assembled.vocabulary[0]?.alternatives).toEqual([]);
  });

  it("does not emit a correction from a low-confidence student segment", () => {
    const tracks = reviewFixtureTracks();
    tracks[0] = {
      ...tracks[0],
      segments: tracks[0].segments.map((segment) => ({
        ...segment,
        confidence: 0.2,
      })),
    };

    const assembled = assembleSessionAnalysis({
      tracks,
      engine: reviewFixtureEngineOutput(),
      policy,
      declaredStudentLevel: "A2",
      teacherAudioPresent: true,
      studentAudioDurationMs: 12_000,
    });

    expect(assembled.corrections).toEqual([]);
    expect(assembled.weakPoints).toEqual([]);
    expect(assembled.degradations).toContain("LOW_TRANSCRIPT_CONFIDENCE");
  });

  it("classifies only grammar and lexical items as errors", () => {
    expect(isErrorCorrectionType("GRAMMAR_ERROR")).toBe(true);
    expect(isErrorCorrectionType("LEXICAL_ERROR")).toBe(true);
    expect(isErrorCorrectionType("NATURALNESS")).toBe(false);
    expect(isErrorCorrectionType("OPTIONAL_IMPROVEMENT")).toBe(false);
  });

  it("keeps retryable failure codes stable", () => {
    expect(isRetryableFailureCode("ANALYSIS_TIMEOUT")).toBe(true);
    expect(isRetryableFailureCode("AUDIO_UNREADABLE")).toBe(false);
  });

  it("includes model identity in the transcript reuse key", () => {
    const left = transcriptReuseKey({
      contentSha256: REVIEW_STUDENT_SHA256,
      engine: "whisper.cpp",
      model: "large-v3-turbo",
      paramsHash: "a",
    });
    const right = transcriptReuseKey({
      contentSha256: REVIEW_STUDENT_SHA256,
      engine: "whisper.cpp",
      model: "small.en",
      paramsHash: "a",
    });
    expect(left).not.toBe(right);
  });

  it("bands numeric confidence for display without storing a second column", () => {
    expect(bandConfidence(0.91)).toBe("HIGH");
    expect(bandConfidence(0.6)).toBe("MEDIUM");
    expect(bandConfidence(0.2)).toBe("LOW");
  });

  it("builds a deterministic silent WAV fixture instead of committing a binary", () => {
    expect(REVIEW_STUDENT_WAV.subarray(0, 4).toString()).toBe("RIFF");
    expect(REVIEW_STUDENT_SHA256).toMatch(/^[0-9a-f]{64}$/);
  });
});

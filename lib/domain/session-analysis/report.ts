import type {
  SessionAnalysisAssembly,
  SessionTeacherFeedback,
} from "./types";

export type SessionLearningReport = {
  sessionId: string;
  layers: {
    aiObservations: {
      transcript: SessionAnalysisAssembly["transcript"];
      corrections: SessionAnalysisAssembly["corrections"];
      vocabulary: SessionAnalysisAssembly["vocabulary"];
      fluency: SessionAnalysisAssembly["fluency"];
      weakPoints: SessionAnalysisAssembly["weakPoints"];
      degradations: SessionAnalysisAssembly["degradations"];
      summaryEn: string;
      summaryFa: string | null;
    };
    aiRecommendations: {
      alternatives: SessionAnalysisAssembly["vocabulary"][number]["alternatives"][];
      suggestions: SessionAnalysisAssembly["suggestions"];
    };
    teacherJudgement: SessionTeacherFeedback | null;
  };
};

export function composeSessionLearningReport(input: {
  sessionId: string;
  analysis: SessionAnalysisAssembly | null;
  teacherFeedback: SessionTeacherFeedback | null;
}): SessionLearningReport {
  if (!input.analysis) {
    return {
      sessionId: input.sessionId,
      layers: {
        aiObservations: {
          transcript: {
            schemaVersion: 1,
            language: "en",
            segments: [],
            studentWordCount: 0,
            teacherWordCount: null,
            studentSpeakingMs: 0,
            teacherSpeakingMs: null,
            meanStudentConfidence: null,
            sources: [],
          },
          corrections: [],
          vocabulary: [],
          fluency: {
            provenance: "AI_OBSERVATION",
            studentSpeakingMs: 0,
            studentWordCount: 0,
            studentWordsPerMinute: 0,
            studentSpeakingRatio: null,
            pauseCount: 0,
            longPauseCount: 0,
            meanPauseMs: null,
            longestPauseMs: null,
            fillerWordCount: 0,
            fillerWordRate: 0,
            selfCorrectionCount: 0,
            repetitionCount: 0,
            abandonedSentenceCount: 0,
            turnCount: null,
            meanStudentTurnMs: null,
            longestStudentTurnMs: null,
            distinctWordCount: 0,
            typeTokenRatio: null,
            narrativeFeedbackEn: "",
            narrativeFeedbackFa: null,
          },
          weakPoints: [],
          degradations: [],
          summaryEn: "",
          summaryFa: null,
        },
        aiRecommendations: {
          alternatives: [],
          suggestions: [],
        },
        teacherJudgement: input.teacherFeedback,
      },
    };
  }

  return {
    sessionId: input.sessionId,
    layers: {
      aiObservations: {
        transcript: input.analysis.transcript,
        corrections: input.analysis.corrections,
        vocabulary: input.analysis.vocabulary,
        fluency: input.analysis.fluency,
        weakPoints: input.analysis.weakPoints,
        degradations: input.analysis.degradations,
        summaryEn: input.analysis.summaryEn,
        summaryFa: input.analysis.summaryFa,
      },
      aiRecommendations: {
        alternatives: input.analysis.vocabulary.map((item) => item.alternatives),
        suggestions: input.analysis.suggestions,
      },
      teacherJudgement: input.teacherFeedback,
    },
  };
}

export function transcriptReuseKey(input: {
  contentSha256: string;
  engine: string;
  model: string;
  paramsHash: string;
}): string {
  return [
    input.contentSha256,
    input.engine,
    input.model,
    input.paramsHash,
  ].join(":");
}

import { createHash } from "node:crypto";

import type {
  AnalysisEngineOutput,
  EngineTrackTranscript,
  SessionAnalysisPolicy,
} from "@/lib/domain/session-analysis";

export const REVIEW_FIXTURE_POLICY: SessionAnalysisPolicy = {
  minDurationMs: 1_000,
  maxDurationMs: 20 * 60 * 1_000,
  confidenceThreshold: 0.5,
  overuseThreshold: 3,
  weakPointMinimumOccurrences: 2,
  optionalImprovementCap: 1,
  generalSuggestionCap: 1,
  longPauseMs: 1_500,
  maxAttempts: 3,
};

export const REVIEW_STUDENT_UTTERANCES = [
  "Yesterday I go to the university and I meet my friend.",
  "We discuss about our project.",
] as const;

export const REVIEW_TEACHER_UTTERANCE = "What did you do there?";

export function createSilentWav(durationMs: number, sampleRate = 16_000): Buffer {
  const samples = Math.round((durationMs / 1000) * sampleRate);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export const REVIEW_STUDENT_WAV = createSilentWav(12_000);
export const REVIEW_TEACHER_WAV = createSilentWav(12_000);
export const REVIEW_STUDENT_SHA256 = sha256Hex(REVIEW_STUDENT_WAV);
export const REVIEW_TEACHER_SHA256 = sha256Hex(REVIEW_TEACHER_WAV);

export function reviewFixtureTracks(): EngineTrackTranscript[] {
  return [
    {
      participantRole: "STUDENT",
      language: "en",
      source: {
        participantRole: "STUDENT",
        contentSha256: REVIEW_STUDENT_SHA256,
        engine: "fake-whisper",
        model: "fixture",
        paramsHash: "fixture-v1",
      },
      segments: [
        {
          startMs: 1_240,
          endMs: 6_000,
          text: REVIEW_STUDENT_UTTERANCES[0],
          confidence: 0.91,
        },
        {
          startMs: 8_000,
          endMs: 11_000,
          text: REVIEW_STUDENT_UTTERANCES[1],
          confidence: 0.88,
        },
      ],
    },
    {
      participantRole: "TEACHER",
      language: "en",
      source: {
        participantRole: "TEACHER",
        contentSha256: REVIEW_TEACHER_SHA256,
        engine: "fake-whisper",
        model: "fixture",
        paramsHash: "fixture-v1",
      },
      segments: [
        {
          startMs: 6_200,
          endMs: 7_400,
          text: REVIEW_TEACHER_UTTERANCE,
          confidence: 0.96,
        },
      ],
    },
  ];
}

export function reviewFixtureEngineOutput(): AnalysisEngineOutput {
  return {
    overallLevelEstimate: "A2",
    summaryEn:
      "The student described a past visit but used present-tense verbs and an extra preposition.",
    summaryFa: null,
    selfCorrectionCount: 0,
    repetitionCount: 0,
    abandonedSentenceCount: 0,
    corrections: [
      {
        type: "GRAMMAR_ERROR",
        subtype: "PAST_SIMPLE",
        originalText: "I go",
        correctedText: "I went",
        explanation:
          '"Yesterday" indicates a completed past event, so the past form of "go" is required: "went".',
        transcriptSegmentIndex: 0,
        charStart: 10,
        charEnd: 14,
        confidence: 0.93,
      },
      {
        type: "GRAMMAR_ERROR",
        subtype: "PAST_SIMPLE",
        originalText: "I meet",
        correctedText: "I met",
        explanation:
          '"Yesterday" requires the past form of "meet": "met".',
        transcriptSegmentIndex: 0,
        charStart: 42,
        charEnd: 48,
        confidence: 0.92,
      },
      {
        type: "LEXICAL_ERROR",
        subtype: "PREPOSITION",
        originalText: "discuss about",
        correctedText: "discuss",
        explanation: '"Discuss" already includes the topic; the extra "about" is not used.',
        transcriptSegmentIndex: 2,
        charStart: 3,
        charEnd: 16,
        confidence: 0.9,
      },
      {
        type: "NATURALNESS",
        subtype: "WORD_ORDER",
        originalText: "Yesterday I go to the university and I meet my friend.",
        correctedText: "Yesterday, I went to the university and met my friend.",
        explanation: "A more natural retelling would combine the clauses.",
        transcriptSegmentIndex: 0,
        charStart: 0,
        charEnd: 54,
        confidence: 0.7,
      },
      {
        type: "OPTIONAL_IMPROVEMENT",
        subtype: "WORD_CHOICE",
        originalText: "university",
        correctedText: "campus",
        explanation: "A stylistic preference, not an error.",
        transcriptSegmentIndex: 0,
        charStart: 21,
        charEnd: 31,
        confidence: 0.4,
      },
      {
        type: "OPTIONAL_IMPROVEMENT",
        subtype: "WORD_CHOICE",
        originalText: "friend",
        correctedText: "classmate",
        explanation: "Another stylistic preference that must be capped.",
        transcriptSegmentIndex: 0,
        charStart: 48,
        charEnd: 54,
        confidence: 0.3,
      },
    ],
    vocabulary: [
      {
        headword: "good",
        lemma: "good",
        partOfSpeech: "ADJECTIVE",
        status: "OVERUSED",
        occurrenceCount: 4,
        cefrLevel: "A1",
        segmentIndexes: [0, 0, 2, 2],
        exampleExcerpt: null,
        confidence: 0.8,
        alternatives: [
          {
            suggestion: "effective",
            cefrLevel: "B1",
            exampleSentence: "It was an effective meeting.",
            definitionFa: null,
          },
          {
            suggestion: "substantial",
            cefrLevel: "C1",
            exampleSentence: "There was a substantial change.",
            definitionFa: null,
          },
        ],
      },
    ],
    suggestions: [
      {
        weakPointKey: "GRAMMAR:PAST_SIMPLE",
        priority: "HIGH",
        kind: "PRACTICE_DRILL",
        focus: "Past simple vs present simple",
        rationale: "You made 2 past-tense errors during this session.",
        activity: "Describe yesterday's activities using 10 past-tense verbs.",
        targetDescription: "Achieve fewer than 2 errors in the next session.",
        targetSubtype: "PAST_SIMPLE",
        targetMaxOccurrences: 1,
        targetLevel: "A2",
        estimatedMinutes: 10,
      },
      {
        weakPointKey: null,
        priority: "LOW",
        kind: "RESOURCE",
        focus: "Improve your grammar",
        rationale: "General advice without a pattern.",
        activity: "Study more English.",
        targetDescription: "Get better.",
        targetSubtype: null,
        targetMaxOccurrences: null,
        targetLevel: null,
        estimatedMinutes: 5,
      },
    ],
  };
}

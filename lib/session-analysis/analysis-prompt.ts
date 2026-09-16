import {
  mergeTrackTranscripts,
  type EngineTrackTranscript,
  type EnglishLevel,
} from "@/lib/domain/session-analysis";

export const ANALYSIS_SYSTEM_PROMPT = `You are Takineo's session-analysis engine.
Return ONLY a JSON object. No markdown. No preamble.
Correct only STUDENT utterances. Never correct the teacher.
Use only these correction types: GRAMMAR_ERROR, LEXICAL_ERROR, NATURALNESS, OPTIONAL_IMPROVEMENT.
Use only these grammar subtypes when they apply: PAST_SIMPLE, PRESENT_SIMPLE, PRESENT_PERFECT, ARTICLE, SUBJECT_VERB_AGREEMENT, WORD_ORDER, OTHER.
Use only these vocabulary subtypes when they apply: PREPOSITION, COLLOCATION, WORD_CHOICE, OVERUSE, OTHER.
Use OTHER only if no registry token fits. Two unrelated OTHER items are not a pattern.
NATURALNESS and OPTIONAL_IMPROVEMENT are not errors.
Cite exactly one distinct student occurrence per GRAMMAR_ERROR or LEXICAL_ERROR. Do not merge two edits into one originalText.
Do not invent a weak-point pattern from a single error.
Do not suggest vocabulary more than one CEFR band above the student's working level.

JSON shape:
{
  "overallLevelEstimate": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|null,
  "summaryEn": string,
  "summaryFa": string|null,
  "selfCorrectionCount": number,
  "repetitionCount": number,
  "abandonedSentenceCount": number,
  "corrections": [
    {
      "type": "GRAMMAR_ERROR"|"LEXICAL_ERROR"|"NATURALNESS"|"OPTIONAL_IMPROVEMENT",
      "subtype": string,
      "originalText": string,
      "correctedText": string,
      "explanation": string,
      "transcriptSegmentIndex": number,
      "charStart": number|null,
      "charEnd": number|null,
      "confidence": number
    }
  ],
  "vocabulary": [],
  "suggestions": []
}`;

export function buildAnalysisUserPrompt(input: {
  tracks: EngineTrackTranscript[];
  declaredStudentLevel: EnglishLevel | null;
}): string {
  const transcript = mergeTrackTranscripts(input.tracks);
  const lines = transcript.segments.map(
    (segment) => `[${segment.index}] ${segment.speaker}: ${segment.text}`,
  );
  const level = input.declaredStudentLevel ?? "unknown";
  return [
    "Analyze this 15-minute speaking-session transcript.",
    `The student working level is ${level}.`,
    "",
    lines.join("\n"),
    "",
    "Identify tense errors, lexical errors, and nothing else that is not in the text.",
  ].join("\n");
}

export function renderQwenChatPrompt(system: string, user: string): string {
  return [
    "<|im_start|>system",
    `${system}<|im_end|>`,
    "<|im_start|>user",
    `${user}<|im_end|>`,
    "<|im_start|>assistant",
    "",
  ].join("\n");
}

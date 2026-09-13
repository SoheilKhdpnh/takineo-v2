import {
  isLevelAdmissible,
  maxAllowedAlternativeLevel,
} from "./level-gating";
import type {
  EnglishLevel,
  ProposedVocabularyObservation,
  SessionAnalysisPolicy,
  SessionTranscript,
  SessionVocabularyObservation,
} from "./types";

export function acceptVocabularyObservations(
  proposed: ProposedVocabularyObservation[],
  transcript: SessionTranscript,
  policy: SessionAnalysisPolicy,
  workingLevel: EnglishLevel | null,
): SessionVocabularyObservation[] {
  const accepted: SessionVocabularyObservation[] = [];

  for (const item of proposed) {
    if (item.occurrenceCount < 1 || item.segmentIndexes.length === 0) {
      continue;
    }

    const evidenceIsStudent = item.segmentIndexes.every((index) => {
      const segment = transcript.segments[index];
      return segment?.speaker === "STUDENT";
    });
    if (!evidenceIsStudent) {
      continue;
    }

    const lowConfidence = item.segmentIndexes.some((index) => {
      const segment = transcript.segments[index];
      return (
        segment?.confidence !== null &&
        segment.confidence < policy.confidenceThreshold
      );
    });
    if (item.status === "MISUSED" && lowConfidence) {
      continue;
    }

    const alternatives = workingLevel
      ? item.alternatives
          .filter((alternative) =>
            isLevelAdmissible(alternative.cefrLevel, workingLevel),
          )
          .map((alternative, index) => ({
            ...alternative,
            rank: index + 1,
            provenance: "AI_RECOMMENDATION" as const,
            maxAllowedLevel: maxAllowedAlternativeLevel(workingLevel),
          }))
      : [];

    accepted.push({
      headword: item.headword.trim().toLowerCase(),
      lemma: item.lemma,
      partOfSpeech: item.partOfSpeech,
      status:
        item.occurrenceCount >= policy.overuseThreshold && item.status !== "MISUSED"
          ? "OVERUSED"
          : item.status,
      occurrenceCount: item.occurrenceCount,
      cefrLevel: item.cefrLevel,
      segmentIndexes: item.segmentIndexes,
      exampleExcerpt: item.exampleExcerpt,
      confidence: item.confidence,
      rank: accepted.length + 1,
      provenance: "AI_OBSERVATION",
      alternatives,
    });
  }

  return accepted;
}

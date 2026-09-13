import { resolveWeakPointSubtype, weakPointKey } from "./weak-point-registry";
import { segmentContainsSpan, normalizeComparableText } from "./transcript";
import {
  isErrorCorrectionType,
  type AcceptedCorrection,
  type ProposedCorrection,
  type SessionAnalysisPolicy,
  type SessionTranscript,
  type WeakPointCategory,
} from "./types";

const TYPE_CATEGORY: Record<string, WeakPointCategory> = {
  GRAMMAR_ERROR: "GRAMMAR",
  LEXICAL_ERROR: "VOCABULARY",
};

export function acceptCorrections(
  proposed: ProposedCorrection[],
  transcript: SessionTranscript,
  policy: SessionAnalysisPolicy,
): AcceptedCorrection[] {
  const accepted: AcceptedCorrection[] = [];
  let optionalCount = 0;

  for (const item of proposed) {
    if (normalizeComparableText(item.originalText) === normalizeComparableText(item.correctedText)) {
      continue;
    }

    const segment = transcript.segments[item.transcriptSegmentIndex];
    if (!segment || segment.speaker !== "STUDENT") {
      continue;
    }

    if (!segmentContainsSpan(segment.text, item.originalText)) {
      continue;
    }

    if (
      segment.confidence !== null &&
      segment.confidence < policy.confidenceThreshold
    ) {
      continue;
    }

    if (item.type === "OPTIONAL_IMPROVEMENT") {
      if (optionalCount >= policy.optionalImprovementCap) {
        continue;
      }
      optionalCount += 1;
    }

    const category = TYPE_CATEGORY[item.type] ?? "GRAMMAR";
    const subtype = resolveWeakPointSubtype(category, item.subtype);

    accepted.push({
      ...item,
      subtype,
      rank: accepted.length + 1,
      provenance: "AI_OBSERVATION",
      weakPointKey:
        isErrorCorrectionType(item.type) && subtype !== "OTHER"
          ? weakPointKey(category, subtype)
          : null,
    });
  }

  return accepted;
}

export function errorCorrections(corrections: AcceptedCorrection[]): AcceptedCorrection[] {
  return corrections.filter((correction) => isErrorCorrectionType(correction.type));
}

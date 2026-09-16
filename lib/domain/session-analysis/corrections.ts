import {
  expandErrorCorrectionCitations,
  locateUniqueCitation,
} from "./correction-spans";
import { resolveWeakPointSubtype, weakPointKey } from "./weak-point-registry";
import { normalizeComparableText } from "./transcript";
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

function occupancyKey(
  segmentIndex: number,
  start: number,
  end: number,
): string {
  return `${segmentIndex}:${start}:${end}`;
}

export function acceptCorrections(
  proposed: ProposedCorrection[],
  transcript: SessionTranscript,
  policy: SessionAnalysisPolicy,
): {
  corrections: AcceptedCorrection[];
  overlappingErrorCitations: boolean;
} {
  const expanded = expandErrorCorrectionCitations(
    proposed,
    (index) => transcript.segments[index]?.text,
  );
  const accepted: AcceptedCorrection[] = [];
  const usedErrorSpans = new Map<string, string>();
  let overlappingErrorCitations = false;
  let optionalCount = 0;

  for (const item of expanded) {
    if (normalizeComparableText(item.originalText) === normalizeComparableText(item.correctedText)) {
      continue;
    }

    const segment = transcript.segments[item.transcriptSegmentIndex];
    if (!segment || segment.speaker !== "STUDENT") {
      continue;
    }

    const span = locateUniqueCitation(segment.text, item.originalText, item);
    if (!span) {
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

    if (isErrorCorrectionType(item.type)) {
      const key = occupancyKey(item.transcriptSegmentIndex, span.start, span.end);
      const fingerprint = [
        item.type,
        item.subtype,
        normalizeComparableText(item.originalText),
        normalizeComparableText(item.correctedText),
      ].join("\n");
      const existing = usedErrorSpans.get(key);
      if (existing) {
        if (existing !== fingerprint) {
          overlappingErrorCitations = true;
        }
        continue;
      }
      usedErrorSpans.set(key, fingerprint);
    }

    const category = TYPE_CATEGORY[item.type] ?? "GRAMMAR";
    const subtype = resolveWeakPointSubtype(category, item.subtype);

    accepted.push({
      ...item,
      charStart: span.start,
      charEnd: span.end,
      subtype,
      rank: accepted.length + 1,
      provenance: "AI_OBSERVATION",
      weakPointKey:
        isErrorCorrectionType(item.type) && subtype !== "OTHER"
          ? weakPointKey(category, subtype)
          : null,
    });
  }

  return {
    corrections: accepted,
    overlappingErrorCitations,
  };
}

export function errorCorrections(corrections: AcceptedCorrection[]): AcceptedCorrection[] {
  return corrections.filter((correction) => isErrorCorrectionType(correction.type));
}

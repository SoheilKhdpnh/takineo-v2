import { errorCorrections } from "./corrections";
import { weakPointKey } from "./weak-point-registry";
import type {
  AcceptedCorrection,
  SessionAnalysisPolicy,
  SessionWeakPoint,
  WeakPointCategory,
  WeakPointSeverity,
} from "./types";

function severityForCount(count: number): WeakPointSeverity {
  if (count >= 5) {
    return "HIGH";
  }
  if (count >= 3) {
    return "MEDIUM";
  }
  return "LOW";
}

function categoryFromKey(key: string): WeakPointCategory {
  return key.split(":")[0] as WeakPointCategory;
}

function subtypeFromKey(key: string): string {
  return key.slice(key.indexOf(":") + 1);
}

export function aggregateWeakPoints(
  corrections: AcceptedCorrection[],
  policy: SessionAnalysisPolicy,
): SessionWeakPoint[] {
  const groups = new Map<string, AcceptedCorrection[]>();

  for (const correction of errorCorrections(corrections)) {
    if (!correction.weakPointKey) {
      continue;
    }
    const existing = groups.get(correction.weakPointKey) ?? [];
    existing.push(correction);
    groups.set(correction.weakPointKey, existing);
  }

  const points: SessionWeakPoint[] = [];

  for (const [key, group] of groups) {
    if (group.length < policy.weakPointMinimumOccurrences) {
      continue;
    }

    const category = categoryFromKey(key);
    const subtype = subtypeFromKey(key);
    const confidence =
      group.reduce((sum, item) => sum + item.confidence, 0) / group.length;

    points.push({
      rank: 0,
      provenance: "AI_OBSERVATION",
      category,
      subtype,
      severity: severityForCount(group.length),
      occurrenceCount: group.length,
      confidence,
      explanation: `${group.length} ${subtype.toLowerCase().replaceAll("_", " ")} error${group.length === 1 ? "" : "s"} across the session.`,
    });
  }

  points.sort((left, right) => {
    if (right.occurrenceCount !== left.occurrenceCount) {
      return right.occurrenceCount - left.occurrenceCount;
    }
    return weakPointKey(left.category, left.subtype).localeCompare(
      weakPointKey(right.category, right.subtype),
    );
  });

  return points.map((point, index) => ({ ...point, rank: index + 1 }));
}

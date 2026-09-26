import { weakPointKey } from "./weak-point-registry";
import type {
  SessionAnalysisPolicy,
  SessionSuggestion,
  SessionWeakPoint,
} from "./types";

export type ProposedSuggestion = Omit<SessionSuggestion, "rank" | "provenance">;

export function acceptSuggestions(
  proposed: ProposedSuggestion[],
  weakPoints: SessionWeakPoint[],
  policy: SessionAnalysisPolicy,
): SessionSuggestion[] {
  const known = new Set(
    weakPoints.map((point) => weakPointKey(point.category, point.subtype)),
  );
  const accepted: SessionSuggestion[] = [];
  let generalCount = 0;

  for (const item of proposed) {
    if (!item.rationale.trim() || !item.activity.trim() || !item.focus.trim()) {
      continue;
    }

    if (item.weakPointKey && !known.has(item.weakPointKey)) {
      continue;
    }

    if (!item.weakPointKey) {
      if (generalCount >= policy.generalSuggestionCap) {
        continue;
      }
      generalCount += 1;
    }

    accepted.push({
      ...item,
      rank: accepted.length + 1,
      provenance: "AI_RECOMMENDATION",
    });
  }

  if (
    weakPoints.length > 0 &&
    !accepted.some((suggestion) => suggestion.weakPointKey === weakPointKey(
      weakPoints[0].category,
      weakPoints[0].subtype,
    ))
  ) {
    const lead = weakPoints[0];
    accepted.unshift({
      rank: 1,
      provenance: "AI_RECOMMENDATION",
      weakPointKey: weakPointKey(lead.category, lead.subtype),
      priority: lead.severity === "HIGH" ? "HIGH" : "MEDIUM",
      kind: "PRACTICE_DRILL",
      focus: lead.subtype.replaceAll("_", " ").toLowerCase(),
      rationale: `You made ${lead.occurrenceCount} ${lead.subtype.toLowerCase().replaceAll("_", " ")} errors during this session.`,
      activity: `Practise ${lead.subtype.replaceAll("_", " ").toLowerCase()} in a short spoken drill.`,
      targetDescription: `Fewer than ${Math.max(lead.occurrenceCount - 1, 0)} errors in the next session.`,
      targetSubtype: lead.subtype,
      targetMaxOccurrences: Math.max(lead.occurrenceCount - 1, 0),
      targetLevel: null,
      estimatedMinutes: 10,
    });

    return accepted.map((suggestion, index) => ({ ...suggestion, rank: index + 1 }));
  }

  return accepted;
}

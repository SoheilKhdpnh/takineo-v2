import type { WeakPointCategory } from "./types";

export type WeakPointRegistryEntry = {
  category: WeakPointCategory;
  subtype: string;
};

const ENTRIES: readonly WeakPointRegistryEntry[] = [
  { category: "GRAMMAR", subtype: "PAST_SIMPLE" },
  { category: "GRAMMAR", subtype: "PRESENT_SIMPLE" },
  { category: "GRAMMAR", subtype: "PRESENT_PERFECT" },
  { category: "GRAMMAR", subtype: "ARTICLE" },
  { category: "GRAMMAR", subtype: "SUBJECT_VERB_AGREEMENT" },
  { category: "GRAMMAR", subtype: "WORD_ORDER" },
  { category: "GRAMMAR", subtype: "OTHER" },
  { category: "VOCABULARY", subtype: "PREPOSITION" },
  { category: "VOCABULARY", subtype: "COLLOCATION" },
  { category: "VOCABULARY", subtype: "WORD_CHOICE" },
  { category: "VOCABULARY", subtype: "OVERUSE" },
  { category: "VOCABULARY", subtype: "OTHER" },
  { category: "PRONUNCIATION", subtype: "SEGMENTAL" },
  { category: "PRONUNCIATION", subtype: "WORD_STRESS" },
  { category: "PRONUNCIATION", subtype: "OTHER" },
  { category: "FLUENCY", subtype: "FILLER" },
  { category: "FLUENCY", subtype: "PAUSE" },
  { category: "FLUENCY", subtype: "REPETITION" },
  { category: "FLUENCY", subtype: "OTHER" },
  { category: "DISCOURSE", subtype: "LINKING" },
  { category: "DISCOURSE", subtype: "TURN_TAKING" },
  { category: "DISCOURSE", subtype: "OTHER" },
  { category: "TASK_RESPONSE", subtype: "INCOMPLETE" },
  { category: "TASK_RESPONSE", subtype: "OTHER" },
];

const KEYS = new Set(ENTRIES.map((entry) => `${entry.category}:${entry.subtype}`));

export const WEAK_POINT_REGISTRY = ENTRIES;

export function resolveWeakPointSubtype(
  category: WeakPointCategory,
  proposed: string,
): string {
  const normalized = proposed.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (KEYS.has(`${category}:${normalized}`)) {
    return normalized;
  }
  return "OTHER";
}

export function weakPointKey(
  category: WeakPointCategory,
  subtype: string,
): string {
  return `${category}:${subtype}`;
}

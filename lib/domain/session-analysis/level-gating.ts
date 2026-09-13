import {
  ENGLISH_LEVELS,
  type EnglishLevel,
} from "./types";

const LEVEL_INDEX = Object.fromEntries(
  ENGLISH_LEVELS.map((level, index) => [level, index]),
) as Record<EnglishLevel, number>;

export function englishLevelIndex(level: EnglishLevel): number {
  return LEVEL_INDEX[level];
}

export function maxAllowedAlternativeLevel(
  studentLevel: EnglishLevel,
): EnglishLevel {
  const index = Math.min(englishLevelIndex(studentLevel) + 1, ENGLISH_LEVELS.length - 1);
  return ENGLISH_LEVELS[index];
}

export function isLevelAdmissible(
  alternativeLevel: EnglishLevel,
  studentLevel: EnglishLevel,
): boolean {
  return englishLevelIndex(alternativeLevel) <= englishLevelIndex(
    maxAllowedAlternativeLevel(studentLevel),
  );
}

export function resolveStudentWorkingLevel(input: {
  declaredLevel: EnglishLevel | null;
  estimatedLevel: EnglishLevel | null;
}): EnglishLevel | null {
  return input.declaredLevel ?? input.estimatedLevel ?? null;
}

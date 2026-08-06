export const ENGLISH_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
] as const;

export type EnglishLevel =
  (typeof ENGLISH_LEVELS)[number];

export const PROFILE_LANGUAGE_CODES = [
  "fa",
  "en",
  "ar",
  "tr",
  "ku",
] as const;

export type ProfileLanguageCode =
  (typeof PROFILE_LANGUAGE_CODES)[number];

export const PROFILE_TIMEZONES = [
  "Asia/Tehran",
  "Asia/Dubai",
  "Europe/Berlin",
  "Europe/Istanbul",
  "Europe/London",
  "America/Toronto",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
] as const;

export type ProfileTimezone =
  (typeof PROFILE_TIMEZONES)[number];
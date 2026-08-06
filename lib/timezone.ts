import { Timezone } from "@/lib/generated/prisma/client";

export type IanaTimezone =
  | "Asia/Tehran"
  | "Asia/Dubai"
  | "Europe/Berlin"
  | "Europe/Istanbul"
  | "Europe/London"
  | "America/Toronto"
  | "America/New_York"
  | "America/Chicago"
  | "America/Los_Angeles"
  | "UTC";

const IANA_TO_ENUM: Record<IanaTimezone, Timezone> = {
  "Asia/Tehran": Timezone.Asia_Tehran,
  "Asia/Dubai": Timezone.Asia_Dubai,
  "Europe/Berlin": Timezone.Europe_Berlin,
  "Europe/Istanbul": Timezone.Europe_Istanbul,
  "Europe/London": Timezone.Europe_London,
  "America/Toronto": Timezone.America_Toronto,
  "America/New_York": Timezone.America_New_York,
  "America/Chicago": Timezone.America_Chicago,
  "America/Los_Angeles": Timezone.America_Los_Angeles,
  UTC: Timezone.UTC,
};

const ENUM_TO_IANA = Object.fromEntries(
  Object.entries(IANA_TO_ENUM).map(([iana, key]) => [key, iana]),
) as Record<Timezone, IanaTimezone>;

export function toTimezoneEnum(iana: IanaTimezone): Timezone {
  const value = IANA_TO_ENUM[iana];
  if (!value) {
    throw new Error(`Unknown timezone: ${iana}`);
  }
  return value;
}

export function fromTimezoneEnum(value: Timezone): IanaTimezone {
  return ENUM_TO_IANA[value];
}
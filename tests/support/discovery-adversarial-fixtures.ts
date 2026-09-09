/*
 * Track D discovery adversarial fixtures.
 *
 * This file deliberately models only already-canonical eligibility inputs
 * and synthetic cardinality. It does NOT define a public discovery DTO,
 * endpoint, ranking, cursor encoding, or final Track A M3 API shape.
 */

export const DISCOVERY_SYNTHETIC_SCALES = [
  1_000,
  10_000,
  50_000,
] as const;

export type DiscoverySyntheticScale =
  (typeof DISCOVERY_SYNTHETIC_SCALES)[number];

export type EligibilityFixtureState =
  | "PUBLIC"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_DISABLED"
  | "APPLICATION_NOT_APPROVED"
  | "PROFILE_INCOMPLETE"
  | "VIDEO_NOT_APPROVED";

export type DiscoveryEligibilityFixture = {
  teacherProfileId: string;

  accountStatus:
    | "ACTIVE"
    | "SUSPENDED"
    | "DISABLED";

  applicationStatus:
    | "DRAFT"
    | "PENDING_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "SUSPENDED";

  profileCompletedAt:
    Date | null;

  introVideoStatus:
    | "UPLOAD_PENDING"
    | "PROCESSING"
    | "READY_FOR_REVIEW"
    | "APPROVED"
    | "REJECTED"
    | "FAILED"
    | null;
};

const completedAt =
  new Date(
    "2026-08-01T00:00:00.000Z",
  );

export function buildDiscoveryEligibilityFixture(
  index: number,
  state: EligibilityFixtureState = "PUBLIC",
): DiscoveryEligibilityFixture {
  const base:
    DiscoveryEligibilityFixture = {
      teacherProfileId:
        `track-d-discovery-teacher-${String(index).padStart(6, "0")}`,

      accountStatus:
        "ACTIVE",

      applicationStatus:
        "APPROVED",

      profileCompletedAt:
        completedAt,

      introVideoStatus:
        "APPROVED",
    };

  switch (state) {
    case "PUBLIC":
      return base;

    case "ACCOUNT_SUSPENDED":
      return {
        ...base,
        accountStatus:
          "SUSPENDED",
      };

    case "ACCOUNT_DISABLED":
      return {
        ...base,
        accountStatus:
          "DISABLED",
      };

    case "APPLICATION_NOT_APPROVED":
      return {
        ...base,
        applicationStatus:
          "PENDING_REVIEW",
      };

    case "PROFILE_INCOMPLETE":
      return {
        ...base,
        profileCompletedAt:
          null,
      };

    case "VIDEO_NOT_APPROVED":
      return {
        ...base,
        introVideoStatus:
          "READY_FOR_REVIEW",
      };
  }
}

export function buildEligibilityMatrix():
  DiscoveryEligibilityFixture[] {
  return [
    buildDiscoveryEligibilityFixture(
      1,
      "PUBLIC",
    ),
    buildDiscoveryEligibilityFixture(
      2,
      "ACCOUNT_SUSPENDED",
    ),
    buildDiscoveryEligibilityFixture(
      3,
      "ACCOUNT_DISABLED",
    ),
    buildDiscoveryEligibilityFixture(
      4,
      "APPLICATION_NOT_APPROVED",
    ),
    buildDiscoveryEligibilityFixture(
      5,
      "PROFILE_INCOMPLETE",
    ),
    buildDiscoveryEligibilityFixture(
      6,
      "VIDEO_NOT_APPROVED",
    ),
  ];
}

export function buildHighCardinalityTeacherIds(
  count: number,
): string[] {
  if (
    !Number.isInteger(count) ||
    count < 0
  ) {
    throw new Error(
      "Synthetic discovery count must be a non-negative integer.",
    );
  }

  return Array.from(
    {
      length:
        count,
    },
    (_, index) =>
      `track-d-discovery-teacher-${String(index + 1).padStart(6, "0")}`,
  );
}

export const DISCOVERY_PAGINATION_ABUSE_VALUES = {
  limit: [
    "",
    "0",
    "-1",
    "1.5",
    "NaN",
    "999999999",
    "1e309",
    " 20 ",
  ],

  cursor: [
    "",
    "garbage",
    "..",
    "%00",
    "A".repeat(8_192),
  ],
} as const;

export const DISCOVERY_QUERY_BOUND_CASES = [
  "NO_AVAILABILITY",
  "DENSE_RECURRING_AVAILABILITY",
  "MANY_HISTORICAL_EXCEPTIONS",
  "MANY_FUTURE_BLOCKS",
  "MANY_HISTORICAL_SESSIONS",
  "NO_FREE_SLOT_WITHIN_HORIZON",
  "FIRST_FREE_SLOT_AT_HORIZON_EDGE",
] as const;

/*
 * Endpoint-agnostic Track D helpers for binding to Track A M3 later.
 *
 * These guards intentionally describe architectural complexity properties,
 * not launch latency SLAs.
 */

export const DISCOVERY_ARCHITECTURAL_BLOCKERS = [
  "N_PLUS_ONE_QUERIES",
  "UNBOUNDED_RECURRENCE_EXPANSION",
  "UNBOUNDED_PAGE_SIZE",
  "UNNECESSARY_ALL_HISTORY_SCAN",
  "RAW_ORM_PUBLIC_DTO",
  "ALL_TEACHERS_WORK_FOR_ONE_PAGE",
  "PATHOLOGICAL_DEEP_OFFSET",
] as const;

export type DiscoveryArchitecturalBlocker =
  (typeof DISCOVERY_ARCHITECTURAL_BLOCKERS)[number];

export const FORBIDDEN_PUBLIC_TEACHER_FIELDS = [
  "applicationStatus",
  "applicationSubmittedAt",
  "applicationReviewedAt",
  "applicationReviewNote",
  "reviewCycle",
  "profileRevision",
  "submittedProfileRevision",
  "submittedVideoId",
  "submittedVideoRevision",
  "submittedVideoUploadId",
  "submittedVideoAssetId",
  "legacyApplicationStatus",
  "legacyApplicationSubmittedAt",
  "legacyApplicationReviewedAt",
  "legacyApplicationReviewNote",
  "legacyTrustMigrationReason",
  "uploadId",
  "assetId",
  "reviewPlaybackId",
  "rejectionReason",
  "adminAccess",
  "auditEvents",
] as const;

export type DiscoveryQueryBucket =
  | "candidateTeachers"
  | "recurringRules"
  | "exceptions"
  | "activeSessions"
  | "other";

export class DiscoveryQueryProbe {
  readonly counts:
    Record<
      DiscoveryQueryBucket,
      number
    > = {
      candidateTeachers:
        0,

      recurringRules:
        0,

      exceptions:
        0,

      activeSessions:
        0,

      other:
        0,
    };

  record(
    bucket: DiscoveryQueryBucket,
  ): void {
    this.counts[bucket] += 1;
  }

  get total(): number {
    return Object.values(
      this.counts,
    ).reduce(
      (sum, count) =>
        sum + count,
      0,
    );
  }
}

export function assertConstantQueryCount(
  samples:
    readonly {
      candidateCount: number;
      queryCount: number;
    }[],
): void {
  if (
    samples.length < 2
  ) {
    throw new Error(
      "At least two query-count samples are required.",
    );
  }

  const baseline =
    samples[0]?.queryCount;

  for (const sample of samples) {
    if (
      sample.queryCount !==
      baseline
    ) {
      throw new Error(
        `Discovery query count grew with candidate cardinality: ${JSON.stringify(samples)}`,
      );
    }
  }
}

export function assertNoForbiddenPublicFields(
  value: unknown,
): void {
  const serialized =
    JSON.stringify(
      value,
    );

  for (
    const field
    of FORBIDDEN_PUBLIC_TEACHER_FIELDS
  ) {
    const quoted =
      JSON.stringify(
        field,
      );

    if (
      serialized.includes(
        `${quoted}:`,
      )
    ) {
      throw new Error(
        `Public discovery payload contains forbidden field: ${field}`,
      );
    }
  }
}

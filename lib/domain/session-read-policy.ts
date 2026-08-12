import type {
  Prisma,
} from "@/lib/generated/prisma/client";

export const SESSION_READ_BUCKETS = [
  "upcoming",
  "history",
] as const;

export type SessionReadBucket =
  (typeof SESSION_READ_BUCKETS)[number];

export type SessionReadBucketCandidate = {
  status:
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED";

  endAt: Date;
};

function assertValidAsOf(
  asOf: Date,
): void {
  if (
    Number.isNaN(
      asOf.getTime(),
    )
  ) {
    throw new RangeError(
      "Session read asOf must be a valid Date.",
    );
  }
}

export function buildSessionBucketWhere(
  bucket: SessionReadBucket,
  asOf: Date,
): Prisma.SpeakingSessionWhereInput {
  assertValidAsOf(
    asOf,
  );

  if (
    bucket ===
    "upcoming"
  ) {
    return {
      status:
        "SCHEDULED",

      endAt: {
        gt:
          asOf,
      },
    };
  }

  return {
    OR: [
      {
        status: {
          in: [
            "COMPLETED",
            "CANCELLED",
          ],
        },
      },
      {
        endAt: {
          lte:
            asOf,
        },
      },
    ],
  };
}

export function isSessionInReadBucket(
  session:
    SessionReadBucketCandidate,
  bucket:
    SessionReadBucket,
  asOf:
    Date,
): boolean {
  assertValidAsOf(
    asOf,
  );

  if (
    bucket ===
    "upcoming"
  ) {
    return (
      session.status ===
        "SCHEDULED" &&
      session.endAt.getTime() >
        asOf.getTime()
    );
  }

  return (
    session.status ===
      "COMPLETED" ||
    session.status ===
      "CANCELLED" ||
    session.endAt.getTime() <=
      asOf.getTime()
  );
}

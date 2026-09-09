import {
  describe,
  expect,
  test,
} from "vitest";

import {
  createSpeakingSessionSchema,
} from "@/lib/validations/booking";

describe(
  "booking validation",
  () => {
    test(
      "accepts a valid booking request",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                "teacher-profile-1",

              startAt:
                "2026-08-15T05:30:00.000Z",

              idempotencyKey:
                "booking-request-00000001",
            });

        expect(
          result.success,
        ).toBe(
          true,
        );
      },
    );

    test(
      "accepts an explicit non-UTC timezone offset",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                "teacher-profile-1",

              startAt:
                "2026-08-15T09:00:00+03:30",

              idempotencyKey:
                "booking-request-00000002",
            });

        expect(
          result.success,
        ).toBe(
          true,
        );
      },
    );

    test(
      "rejects a timestamp without an explicit timezone",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                "teacher-profile-1",

              startAt:
                "2026-08-15T09:00:00",

              idempotencyKey:
                "booking-request-00000003",
            });

        expect(
          result.success,
        ).toBe(
          false,
        );
      },
    );

    test(
      "rejects a start outside the 15-minute grid",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                "teacher-profile-1",

              startAt:
                "2026-08-15T05:31:00.000Z",

              idempotencyKey:
                "booking-request-00000004",
            });

        expect(
          result.success,
        ).toBe(
          false,
        );
      },
    );

    test(
      "rejects seconds on the booking timestamp",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                "teacher-profile-1",

              startAt:
                "2026-08-15T05:30:01.000Z",

              idempotencyKey:
                "booking-request-00000005",
            });

        expect(
          result.success,
        ).toBe(
          false,
        );
      },
    );

    test(
      "rejects a whitespace-padded teacher profile identifier",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                " teacher-profile-1",

              startAt:
                "2026-08-15T05:30:00.000Z",

              idempotencyKey:
                "booking-request-00000006",
            });

        expect(
          result.success,
        ).toBe(
          false,
        );
      },
    );

    test(
      "rejects an undersized idempotency key",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                "teacher-profile-1",

              startAt:
                "2026-08-15T05:30:00.000Z",

              idempotencyKey:
                "too-short",
            });

        expect(
          result.success,
        ).toBe(
          false,
        );
      },
    );

    test(
      "rejects unknown request fields",
      () => {
        const result =
          createSpeakingSessionSchema
            .safeParse({
              teacherProfileId:
                "teacher-profile-1",

              startAt:
                "2026-08-15T05:30:00.000Z",

              idempotencyKey:
                "booking-request-00000007",

              durationMinutes:
                30,
            });

        expect(
          result.success,
        ).toBe(
          false,
        );
      },
    );
  },
);

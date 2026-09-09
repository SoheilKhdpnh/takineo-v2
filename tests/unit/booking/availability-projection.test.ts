import {
  describe,
  expect,
  test,
} from "vitest";

import {
  getBookingWeekday,
} from "@/lib/domain/booking";
import {
  iranLocalDateMinuteToInstant,
} from "@/lib/time/iran-booking-time";
import {
  projectAvailabilityForDate,
} from "@/lib/services/availability-projection.service";
import {
  replaceTeacherAvailabilitySchema,
  teacherAvailabilityExceptionSchema,
} from "@/lib/validations/teacher-availability";

describe(
  "Wave 2 availability projection",
  () => {
    const now =
      new Date(
        "2026-08-10T08:00:00Z",
      );

    test(
      "uses Iran Saturday-first booking weekdays correctly",
      () => {
        expect(
          getBookingWeekday(
            "2026-08-15",
          ),
        ).toBe(
          "SATURDAY",
        );

        expect(
          getBookingWeekday(
            "2026-08-14",
          ),
        ).toBe(
          "FRIDAY",
        );
      },
    );

    test(
      "converts Tehran-local minutes into absolute instants",
      () => {
        expect(
          iranLocalDateMinuteToInstant(
            "2026-08-15",
            540,
          ).toISOString(),
        ).toBe(
          "2026-08-15T05:30:00.000Z",
        );
      },
    );

    test(
      "projects recurring availability into 15-minute slots",
      () => {
        const slots =
          projectAvailabilityForDate(
            {
              date:
                "2026-08-15",

              now,

              rules: [
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    540,
                  endMinute:
                    600,
                  isActive:
                    true,
                },
              ],

              exceptions:
                [],
            },
          );

        expect(
          slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          540,
          555,
          570,
          585,
        ]);
      },
    );

    test(
      "merges adjacent availability windows without duplicate slots",
      () => {
        const slots =
          projectAvailabilityForDate(
            {
              date:
                "2026-08-15",

              now,

              rules: [
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    540,
                  endMinute:
                    570,
                  isActive:
                    true,
                },
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    570,
                  endMinute:
                    600,
                  isActive:
                    true,
                },
              ],

              exceptions:
                [],
            },
          );

        expect(
          slots,
        ).toHaveLength(4);
      },
    );

    test(
      "UNAVAILABLE exceptions subtract recurring time",
      () => {
        const slots =
          projectAvailabilityForDate(
            {
              date:
                "2026-08-15",

              now,

              rules: [
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    540,
                  endMinute:
                    600,
                  isActive:
                    true,
                },
              ],

              exceptions: [
                {
                  date:
                    "2026-08-15",
                  startMinute:
                    555,
                  endMinute:
                    585,
                  type:
                    "UNAVAILABLE",
                },
              ],
            },
          );

        expect(
          slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          540,
          585,
        ]);
      },
    );

    test(
      "AVAILABLE exceptions create slots outside recurring availability",
      () => {
        const slots =
          projectAvailabilityForDate(
            {
              date:
                "2026-08-15",

              now,

              rules: [],

              exceptions: [
                {
                  date:
                    "2026-08-15",
                  startMinute:
                    660,
                  endMinute:
                    705,
                  type:
                    "AVAILABLE",
                },
              ],
            },
          );

        expect(
          slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          660,
          675,
          690,
        ]);
      },
    );

    test(
      "occupied sessions remove exactly their slot",
      () => {
        const occupied =
          iranLocalDateMinuteToInstant(
            "2026-08-15",
            570,
          );

        const slots =
          projectAvailabilityForDate(
            {
              date:
                "2026-08-15",

              now,

              rules: [
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    540,
                  endMinute:
                    600,
                  isActive:
                    true,
                },
              ],

              exceptions:
                [],

              occupiedStartTimes:
                [
                  occupied,
                ],
            },
          );

        expect(
          slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          540,
          555,
          585,
        ]);
      },
    );

    test(
      "minimum booking lead time removes too-near slots",
      () => {
        const localNow =
          new Date(
            "2026-08-15T05:20:00Z",
          );

        const slots =
          projectAvailabilityForDate(
            {
              date:
                "2026-08-15",

              now:
                localNow,

              rules: [
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    540,
                  endMinute:
                    630,
                  isActive:
                    true,
                },
              ],

              exceptions:
                [],
            },
          );

        expect(
          slots.map(
            (slot) =>
              slot.startMinute,
          ),
        ).toEqual([
          570,
          585,
          600,
          615,
        ]);
      },
    );

    test(
      "weekly validation rejects overlapping active windows",
      () => {
        const result =
          replaceTeacherAvailabilitySchema.safeParse(
            {
              rules: [
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    540,
                  endMinute:
                    600,
                  isActive:
                    true,
                },
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    585,
                  endMinute:
                    645,
                  isActive:
                    true,
                },
              ],
            },
          );

        expect(
          result.success,
        ).toBe(false);
      },
    );

    test(
      "weekly validation permits adjacent active windows",
      () => {
        const result =
          replaceTeacherAvailabilitySchema.safeParse(
            {
              rules: [
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    540,
                  endMinute:
                    600,
                  isActive:
                    true,
                },
                {
                  weekday:
                    "SATURDAY",
                  startMinute:
                    600,
                  endMinute:
                    660,
                  isActive:
                    true,
                },
              ],
            },
          );

        expect(
          result.success,
        ).toBe(true);
      },
    );

    test(
      "exception validation rejects impossible calendar dates",
      () => {
        const result =
          teacherAvailabilityExceptionSchema.safeParse(
            {
              date:
                "2026-02-31",
              startMinute:
                540,
              endMinute:
                600,
              type:
                "UNAVAILABLE",
            },
          );

        expect(
          result.success,
        ).toBe(false);
      },
    );

    test(
      "exception validation normalizes a valid note",
      () => {
        const result =
          teacherAvailabilityExceptionSchema.parse(
            {
              date:
                "2026-08-15",
              startMinute:
                540,
              endMinute:
                600,
              type:
                "UNAVAILABLE",
              note:
                "  appointment  ",
            },
          );

        expect(
          result.note,
        ).toBe(
          "appointment",
        );
      },
    );
  },
);

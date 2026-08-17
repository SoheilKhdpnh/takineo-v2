import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    listPublicTeachers:
      vi.fn(),
  }));

vi.mock(
  "@/lib/services/teacher-discovery.service",
  () => ({
    TEACHER_DISCOVERY_MAX_PAGE_SIZE:
      40,

    listPublicTeachers:
      mocks.listPublicTeachers,
  }),
);

import {
  BookableSlotsRangeError,
} from "@/lib/errors/booking-errors";

import {
  dynamic,
  GET as getTeachers,
  runtime,
} from "@/app/api/teachers/route";

const VALID_URL =
  "http://localhost:3000/api/teachers" +
  "?fromDate=2026-08-17" +
  "&toDate=2026-08-23" +
  "&limit=20";

beforeEach(() => {
  vi.clearAllMocks();

  mocks
    .listPublicTeachers
    .mockResolvedValue({
      teachers:
        [],

      nextCursor:
        null,
    });
});

describe(
  "public teacher discovery route",
  () => {
    it(
      "is explicitly Node.js and dynamic",
      () => {
        expect(
          runtime,
        ).toBe(
          "nodejs",
        );

        expect(
          dynamic,
        ).toBe(
          "force-dynamic",
        );
      },
    );

    it(
      "returns a public discovery page and serializes availability instants",
      async () => {
        mocks
          .listPublicTeachers
          .mockResolvedValue({
            teachers: [
              {
                teacherProfileId:
                  "teacher-a",

                name:
                  "Teacher A",

                image:
                  null,

                headline:
                  "Conversation teacher",

                experienceYears:
                  5,

                nativeLanguage:
                  "fa",

                teachingLanguage:
                  "en",

                nextAvailableAt:
                  new Date(
                    "2026-08-18T05:30:00.000Z",
                  ),
              },
            ],

            nextCursor:
              "teacher-a",
          });

        const response =
          await getTeachers(
            new Request(
              VALID_URL,
            ),
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "no-store",
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          teachers: [
            {
              teacherProfileId:
                "teacher-a",

              name:
                "Teacher A",

              image:
                null,

              headline:
                "Conversation teacher",

              experienceYears:
                5,

              nativeLanguage:
                "fa",

              teachingLanguage:
                "en",

              nextAvailableAt:
                "2026-08-18T05:30:00.000Z",
            },
          ],

          nextCursor:
            "teacher-a",
        });

        expect(
          mocks
            .listPublicTeachers,
        ).toHaveBeenCalledWith({
          fromDate:
            "2026-08-17",

          toDate:
            "2026-08-23",

          limit:
            20,
        });
      },
    );

    it(
      "defaults the bounded page size to 20",
      async () => {
        await getTeachers(
          new Request(
            "http://localhost:3000/api/teachers" +
              "?fromDate=2026-08-17" +
              "&toDate=2026-08-23",
          ),
        );

        expect(
          mocks
            .listPublicTeachers,
        ).toHaveBeenCalledWith({
          fromDate:
            "2026-08-17",

          toDate:
            "2026-08-23",

          limit:
            20,
        });
      },
    );

    it(
      "passes a canonical cursor to the service",
      async () => {
        await getTeachers(
          new Request(
            VALID_URL +
              "&cursor=teacher-previous",
          ),
        );

        expect(
          mocks
            .listPublicTeachers,
        ).toHaveBeenCalledWith({
          fromDate:
            "2026-08-17",

          toDate:
            "2026-08-23",

          limit:
            20,

          cursor:
            "teacher-previous",
        });
      },
    );

    it.each([
      [
        "missing fromDate",
        "http://localhost:3000/api/teachers" +
          "?toDate=2026-08-23",
      ],

      [
        "missing toDate",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17",
      ],

      [
        "zero limit",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17" +
          "&toDate=2026-08-23" +
          "&limit=0",
      ],

      [
        "negative limit",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17" +
          "&toDate=2026-08-23" +
          "&limit=-1",
      ],

      [
        "non-integer limit",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17" +
          "&toDate=2026-08-23" +
          "&limit=2.5",
      ],

      [
        "non-numeric limit",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17" +
          "&toDate=2026-08-23" +
          "&limit=abc",
      ],

      [
        "oversized limit",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17" +
          "&toDate=2026-08-23" +
          "&limit=41",
      ],

      [
        "empty cursor",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17" +
          "&toDate=2026-08-23" +
          "&cursor=",
      ],

      [
        "padded cursor",
        "http://localhost:3000/api/teachers" +
          "?fromDate=2026-08-17" +
          "&toDate=2026-08-23" +
          "&cursor=%20teacher-a%20",
      ],
    ])(
      "returns stable 400 for %s before service access",
      async (
        _label,
        url,
      ) => {
        const response =
          await getTeachers(
            new Request(
              url,
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "no-store",
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            "INVALID_REQUEST",
        });

        expect(
          mocks
            .listPublicTeachers,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects unknown query parameters instead of silently accepting ambiguous API input",
      async () => {
        const response =
          await getTeachers(
            new Request(
              VALID_URL +
                "&admin=true",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            "INVALID_REQUEST",
        });

        expect(
          mocks
            .listPublicTeachers,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects duplicate query parameters instead of choosing one implicitly",
      async () => {
        const response =
          await getTeachers(
            new Request(
              VALID_URL +
                "&limit=10",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            "INVALID_REQUEST",
        });

        expect(
          mocks
            .listPublicTeachers,
        ).not.toHaveBeenCalled();
      },
    );

    it.each([
      "INVALID_DATE_RANGE",
      "RANGE_TOO_LARGE",
    ] as const)(
      "maps service range error %s to a stable public 400",
      async (
        reason,
      ) => {
        mocks
          .listPublicTeachers
          .mockRejectedValue(
            new BookableSlotsRangeError(
              reason,
            ),
          );

        const response =
          await getTeachers(
            new Request(
              VALID_URL,
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "no-store",
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            reason,
        });
      },
    );

    it(
      "does not expose unexpected service error details",
      async () => {
        mocks
          .listPublicTeachers
          .mockRejectedValue(
            new Error(
              "postgresql://private-user:private-password@secret-host/db",
            ),
          );

        const response =
          await getTeachers(
            new Request(
              VALID_URL,
            ),
          );

        expect(
          response.status,
        ).toBe(
          500,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "no-store",
        );

        const body =
          await response.json();

        expect(
          body,
        ).toEqual({
          error:
            "INTERNAL_SERVER_ERROR",
        });

        expect(
          JSON.stringify(
            body,
          ),
        ).not.toContain(
          "private-password",
        );
      },
    );
  },
);

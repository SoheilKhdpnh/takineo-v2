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
      mocks
        .listPublicTeachers,
  }),
);

import {
  GET as getTeachers,
} from "@/app/api/teachers/route";

const BASE =
  "http://localhost:3000/api/teachers";

function request(
  query:
    string,
): Request {
  return new Request(
    `${BASE}?${query}`,
  );
}

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
  "Track D M3 discovery route adversarial verification",
  () => {
    it.each([
      "0",
      "-1",
      "41",
      "999999999",
      "1.5",
      "NaN",
      "Infinity",
    ])(
      "rejects abusive limit=%s without invoking discovery",
      async (
        limit,
      ) => {
        const response =
          await getTeachers(
            request(
              `fromDate=2026-08-18&toDate=2026-08-24&limit=${encodeURIComponent(
                limit,
              )}`,
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          response.headers
            .get(
              "cache-control",
            )
            ?.toLowerCase(),
        ).toContain(
          "no-store",
        );

        expect(
          mocks
            .listPublicTeachers,
        ).not.toHaveBeenCalled();
      },
    );

    it.each([
      "",
      "%20",
      "%20teacher",
      "teacher%20",
      "%09teacher",
    ])(
      "rejects non-canonical cursor encoding %j without invoking discovery",
      async (
        cursor,
      ) => {
        const response =
          await getTeachers(
            request(
              `fromDate=2026-08-18&toDate=2026-08-24&cursor=${cursor}`,
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          mocks
            .listPublicTeachers,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "does not turn unsupported private/search parameters into a discovery oracle",
      async () => {
        const marker =
          "track-d-private-oracle-marker";

        const response =
          await getTeachers(
            request(
              [
                "fromDate=2026-08-18",
                "toDate=2026-08-24",
                `email=${marker}%40example.test`,
                "phone=%2B981234567890",
                "applicationStatus=SUSPENDED",
                `search=${marker}`,
                "applicationId=private-application-id",
              ].join(
                "&",
              ),
            ),
          );

        /*
         * Both policies are safe:
         * 1. reject unknown parameters with 400; or
         * 2. ignore them and pass only the canonical discovery input.
         *
         * What is forbidden is forwarding them as hidden search/filter
         * semantics that can become an enumeration oracle.
         */
        expect([
          200,
          400,
        ]).toContain(
          response.status,
        );

        const body =
          await response.text();

        expect(
          body,
        ).not.toContain(
          marker,
        );

        expect(
          body,
        ).not.toContain(
          "private-application-id",
        );

        if (
          response.status ===
          400
        ) {
          expect(
            mocks
              .listPublicTeachers,
          ).not.toHaveBeenCalled();

          return;
        }

        expect(
          mocks
            .listPublicTeachers,
        ).toHaveBeenCalledTimes(
          1,
        );

        const serviceInput =
          mocks
            .listPublicTeachers
            .mock
            .calls[0]?.[0];

        expect(
          serviceInput,
        ).toEqual({
          fromDate:
            "2026-08-18",

          toDate:
            "2026-08-24",

          limit:
            20,
        });

        expect(
          JSON.stringify(
            serviceInput,
          ),
        ).not.toContain(
          marker,
        );

        expect(
          JSON.stringify(
            serviceInput,
          ),
        ).not.toContain(
          "SUSPENDED",
        );
      },
    );

    it(
      "keeps a canonical cursor opaque and forwards it only as the keyset boundary",
      async () => {
        const response =
          await getTeachers(
            request(
              "fromDate=2026-08-18&toDate=2026-08-24&limit=40&cursor=teacher-profile-020",
            ),
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          mocks
            .listPublicTeachers,
        ).toHaveBeenCalledWith({
          fromDate:
            "2026-08-18",

          toDate:
            "2026-08-24",

          limit:
            40,

          cursor:
            "teacher-profile-020",
        });
      },
    );
  },
);

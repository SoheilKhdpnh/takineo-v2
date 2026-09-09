import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(
    () => ({
      getApiSession:
        vi.fn(),

      listSpeakingSessions:
        vi.fn(),

      getSpeakingSessionForViewer:
        vi.fn(),
    }),
  );

vi.mock(
  "@/lib/auth/api-session",
  () => ({
    getApiSession:
      mocks.getApiSession,
  }),
);

vi.mock(
  "@/lib/services/speaking-session-read.service",
  () => ({
    listSpeakingSessions:
      mocks.listSpeakingSessions,

    getSpeakingSessionForViewer:
      mocks.getSpeakingSessionForViewer,
  }),
);

import {
  GET as listSessions,
} from "@/app/api/sessions/route";
import {
  GET as getSessionDetail,
} from "@/app/api/sessions/[sessionId]/route";
import {
  SessionReadCursorError,
  SessionReadForbiddenError,
  SessionReadInvariantError,
  SessionReadTargetNotFoundError,
} from "@/lib/errors/session-read-errors";

const START_AT =
  new Date(
    "2026-08-20T10:00:00.000Z",
  );

const END_AT =
  new Date(
    "2026-08-20T10:15:00.000Z",
  );

function authenticatedSession() {
  return {
    user: {
      id:
        "student-user",
    },
  };
}

function sessionView() {
  return {
    id:
      "session-1",

    startAt:
      START_AT,

    endAt:
      END_AT,

    status:
      "SCHEDULED" as const,

    counterparty: {
      type:
        "TEACHER" as const,

      userId:
        "teacher-user",

      teacherProfileId:
        "teacher-profile",

      name:
        "Teacher Name",

      image:
        "teacher.png",

      headline:
        "Conversation teacher",
    },

    cancellation:
      null,
  };
}

function detailContext(
  sessionId =
    "session-1",
) {
  return {
    params:
      Promise.resolve({
        sessionId,
      }),
  };
}

describe(
  "speaking-session read routes",
  () => {
    let consoleError:
      ReturnType<
        typeof vi.spyOn
      >;

    beforeEach(
      () => {
        mocks.getApiSession
          .mockReset();

        mocks.listSpeakingSessions
          .mockReset();

        mocks.getSpeakingSessionForViewer
          .mockReset();

        mocks.getApiSession
          .mockResolvedValue(
            authenticatedSession(),
          );

        mocks.listSpeakingSessions
          .mockResolvedValue({
            items:
              [],

            hasMore:
              false,

            nextCursor:
              null,
          });

        mocks.getSpeakingSessionForViewer
          .mockResolvedValue(
            sessionView(),
          );

        consoleError =
          vi
            .spyOn(
              console,
              "error",
            )
            .mockImplementation(
              () => {},
            );
      },
    );

    afterEach(
      () => {
        consoleError
          .mockRestore();
      },
    );

    test(
      "list returns 401 when there is no active API session",
      async () => {
        mocks.getApiSession
          .mockResolvedValue(
            null,
          );

        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming",
            ),
          );

        expect(
          response.status,
        ).toBe(
          401,
        );

        expect(
          await response.json(),
        ).toEqual({
          error:
            "UNAUTHORIZED",
        });

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );

        expect(
          mocks.listSpeakingSessions,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "list requires a bucket",
      async () => {
        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          mocks.listSpeakingSessions,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "list rejects an unknown bucket",
      async () => {
        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=past",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );
      },
    );

    test(
      "list rejects unknown query parameters",
      async () => {
        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming&role=TEACHER",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          mocks.listSpeakingSessions,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "list rejects duplicate query parameters",
      async () => {
        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming&bucket=history",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          mocks.listSpeakingSessions,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "list rejects invalid limits",
      async () => {
        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming&limit=101",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          mocks.listSpeakingSessions,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "list rejects non-decimal limit syntax",
      async () => {
        const invalidLimits = [
          "01",
          "1.5",
          "1e2",
          "0x10",
        ];

        for (
          const limit of
          invalidLimits
        ) {
          const response =
            await listSessions(
              new Request(
                `http://localhost/api/sessions?bucket=upcoming&limit=${encodeURIComponent(limit)}`,
              ),
            );

          expect(
            response.status,
          ).toBe(
            400,
          );
        }

        expect(
          mocks.listSpeakingSessions,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "list applies the default limit and calls the service with authenticated ownership only",
      async () => {
        await listSessions(
          new Request(
            "http://localhost/api/sessions?bucket=upcoming",
          ),
        );

        expect(
          mocks.listSpeakingSessions,
        ).toHaveBeenCalledWith(
          "student-user",
          {
            bucket:
              "upcoming",

            limit:
              20,
          },
        );
      },
    );

    test(
      "list parses an explicit limit and opaque cursor",
      async () => {
        await listSessions(
          new Request(
            "http://localhost/api/sessions?bucket=history&limit=7&cursor=opaque_cursor",
          ),
        );

        expect(
          mocks.listSpeakingSessions,
        ).toHaveBeenCalledWith(
          "student-user",
          {
            bucket:
              "history",

            limit:
              7,

            cursor:
              "opaque_cursor",
          },
        );
      },
    );

    test(
      "list serializes session timestamps to ISO strings",
      async () => {
        mocks.listSpeakingSessions
          .mockResolvedValue({
            items: [
              sessionView(),
            ],

            hasMore:
              true,

            nextCursor:
              "next-cursor",
          });

        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming",
            ),
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          await response.json(),
        ).toEqual({
          items: [
            {
              id:
                "session-1",

              startAt:
                "2026-08-20T10:00:00.000Z",

              endAt:
                "2026-08-20T10:15:00.000Z",

              status:
                "SCHEDULED",

              counterparty: {
                type:
                  "TEACHER",

                userId:
                  "teacher-user",

                teacherProfileId:
                  "teacher-profile",

                name:
                  "Teacher Name",

                image:
                  "teacher.png",

                headline:
                  "Conversation teacher",
              },

              cancellation:
                null,
            },
          ],

          hasMore:
            true,

          nextCursor:
            "next-cursor",
        });

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );
      },
    );

    test(
      "list maps malformed opaque cursors to 400",
      async () => {
        mocks.listSpeakingSessions
          .mockRejectedValue(
            new SessionReadCursorError(),
          );

        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming&cursor=bad",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          await response.json(),
        ).toEqual({
          error:
            "INVALID_REQUEST",
        });
      },
    );

    test(
      "list maps forbidden viewers to 403",
      async () => {
        mocks.listSpeakingSessions
          .mockRejectedValue(
            new SessionReadForbiddenError(),
          );

        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming",
            ),
          );

        expect(
          response.status,
        ).toBe(
          403,
        );

        expect(
          await response.json(),
        ).toEqual({
          error:
            "SESSION_READ_FORBIDDEN",
        });
      },
    );

    test(
      "list maps invariant failures to a generic 500",
      async () => {
        mocks.listSpeakingSessions
          .mockRejectedValue(
            new SessionReadInvariantError(
              "private invariant detail",
            ),
          );

        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=upcoming",
            ),
          );

        expect(
          response.status,
        ).toBe(
          500,
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
          "private invariant detail",
        );
      },
    );

    test(
      "list maps unexpected failures to a generic 500",
      async () => {
        mocks.listSpeakingSessions
          .mockRejectedValue(
            new Error(
              "database secret",
            ),
          );

        const response =
          await listSessions(
            new Request(
              "http://localhost/api/sessions?bucket=history",
            ),
          );

        expect(
          response.status,
        ).toBe(
          500,
        );

        expect(
          await response.json(),
        ).toEqual({
          error:
            "INTERNAL_SERVER_ERROR",
        });
      },
    );

    test(
      "detail returns 401 when there is no active API session",
      async () => {
        mocks.getApiSession
          .mockResolvedValue(
            null,
          );

        const response =
          await getSessionDetail(
            new Request(
              "http://localhost/api/sessions/session-1",
            ),
            detailContext(),
          );

        expect(
          response.status,
        ).toBe(
          401,
        );

        expect(
          mocks.getSpeakingSessionForViewer,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "detail rejects an invalid path identifier before calling the service",
      async () => {
        const response =
          await getSessionDetail(
            new Request(
              "http://localhost/api/sessions/bad",
            ),
            detailContext(
              "bad session",
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          mocks.getSpeakingSessionForViewer,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "detail calls the service with only the authenticated user and path session ID",
      async () => {
        await getSessionDetail(
          new Request(
            "http://localhost/api/sessions/session-1",
          ),
          detailContext(
            "session-1",
          ),
        );

        expect(
          mocks.getSpeakingSessionForViewer,
        ).toHaveBeenCalledWith(
          "student-user",
          "session-1",
        );
      },
    );

    test(
      "detail serializes timestamps and cancellation metadata without reason",
      async () => {
        mocks.getSpeakingSessionForViewer
          .mockResolvedValue({
            ...sessionView(),

            status:
              "CANCELLED",

            cancellation: {
              actorType:
                "TEACHER",

              cancelledAt:
                new Date(
                  "2026-08-19T10:00:00.000Z",
                ),

              reason:
                "must never escape",
            },
          });

        const response =
          await getSessionDetail(
            new Request(
              "http://localhost/api/sessions/session-1",
            ),
            detailContext(),
          );

        const body =
          await response.json();

        expect(
          body.startAt,
        ).toBe(
          "2026-08-20T10:00:00.000Z",
        );

        expect(
          body.endAt,
        ).toBe(
          "2026-08-20T10:15:00.000Z",
        );

        expect(
          body.cancellation,
        ).toEqual({
          actorType:
            "TEACHER",

          cancelledAt:
            "2026-08-19T10:00:00.000Z",
        });

        expect(
          body.cancellation.reason,
        ).toBeUndefined();

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );
      },
    );

    test(
      "detail maps nonexistent and unowned targets to 404",
      async () => {
        mocks.getSpeakingSessionForViewer
          .mockRejectedValue(
            new SessionReadTargetNotFoundError(),
          );

        const response =
          await getSessionDetail(
            new Request(
              "http://localhost/api/sessions/private-session",
            ),
            detailContext(
              "private-session",
            ),
          );

        expect(
          response.status,
        ).toBe(
          404,
        );

        expect(
          await response.json(),
        ).toEqual({
          error:
            "SESSION_NOT_FOUND",
        });
      },
    );

    test(
      "detail maps forbidden viewers to 403",
      async () => {
        mocks.getSpeakingSessionForViewer
          .mockRejectedValue(
            new SessionReadForbiddenError(),
          );

        const response =
          await getSessionDetail(
            new Request(
              "http://localhost/api/sessions/session-1",
            ),
            detailContext(),
          );

        expect(
          response.status,
        ).toBe(
          403,
        );
      },
    );

    test(
      "detail maps invariant failures to a generic 500",
      async () => {
        mocks.getSpeakingSessionForViewer
          .mockRejectedValue(
            new SessionReadInvariantError(
              "private detail",
            ),
          );

        const response =
          await getSessionDetail(
            new Request(
              "http://localhost/api/sessions/session-1",
            ),
            detailContext(),
          );

        expect(
          response.status,
        ).toBe(
          500,
        );

        expect(
          await response.json(),
        ).toEqual({
          error:
            "INTERNAL_SERVER_ERROR",
        });
      },
    );

    test(
      "detail maps unexpected failures to a generic 500",
      async () => {
        mocks.getSpeakingSessionForViewer
          .mockRejectedValue(
            new Error(
              "unexpected",
            ),
          );

        const response =
          await getSessionDetail(
            new Request(
              "http://localhost/api/sessions/session-1",
            ),
            detailContext(),
          );

        expect(
          response.status,
        ).toBe(
          500,
        );
      },
    );
  },
);

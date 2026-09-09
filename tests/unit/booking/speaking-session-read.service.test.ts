import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(
  () => ({
    getUserAccessContext:
      vi.fn(),

    findMany:
      vi.fn(),

    findFirst:
      vi.fn(),
  }),
);

vi.mock(
  "@/lib/auth/access",
  () => ({
    getUserAccessContext:
      mocks.getUserAccessContext,
  }),
);

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma: {
      speakingSession: {
        findMany:
          mocks.findMany,

        findFirst:
          mocks.findFirst,
      },
    },
  }),
);

import {
  decodeSessionReadCursor,
  encodeSessionReadCursor,
} from "@/lib/domain/session-read-cursor";
import {
  SessionReadCursorError,
  SessionReadForbiddenError,
  SessionReadInvariantError,
  SessionReadTargetNotFoundError,
} from "@/lib/errors/session-read-errors";
import {
  getSpeakingSessionForViewer,
  listSpeakingSessions,
} from "@/lib/services/speaking-session-read.service";

const asOf =
  new Date(
    "2026-08-12T10:00:00.000Z",
  );

function studentAccess() {
  return {
    id:
      "student-user",

    role:
      "STUDENT",

    accountStatus:
      "ACTIVE",

    studentProfile: {
      id:
        "student-profile",
    },

    teacherProfile:
      null,
  };
}

function teacherAccess() {
  return {
    id:
      "teacher-user",

    role:
      "TEACHER",

    accountStatus:
      "ACTIVE",

    studentProfile:
      null,

    teacherProfile: {
      id:
        "teacher-profile",
    },
  };
}

function studentViewerRow(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    id:
      "session-1",

    startAt:
      new Date(
        "2026-08-13T10:00:00.000Z",
      ),

    endAt:
      new Date(
        "2026-08-13T10:15:00.000Z",
      ),

    status:
      "SCHEDULED",

    teacherProfile: {
      id:
        "teacher-profile",

      userId:
        "teacher-user",

      headline:
        "Conversation teacher",

      user: {
        id:
          "teacher-user",

        name:
          "Teacher Name",

        image:
          "teacher.png",
      },
    },

    cancellation:
      null,

    ...overrides,
  };
}

function teacherViewerRow(
  overrides: Record<
    string,
    unknown
  > = {},
) {
  return {
    id:
      "session-1",

    startAt:
      new Date(
        "2026-08-13T10:00:00.000Z",
      ),

    endAt:
      new Date(
        "2026-08-13T10:15:00.000Z",
      ),

    status:
      "SCHEDULED",

    studentUser: {
      id:
        "student-user",

      name:
        "Student Name",

      image:
        null,
    },

    cancellation:
      null,

    ...overrides,
  };
}

describe(
  "speaking-session read service",
  () => {
    beforeEach(() => {
      mocks.getUserAccessContext
        .mockReset();

      mocks.findMany
        .mockReset();

      mocks.findFirst
        .mockReset();

      mocks.getUserAccessContext
        .mockResolvedValue(
          studentAccess(),
        );

      mocks.findMany
        .mockResolvedValue(
          [],
        );

      mocks.findFirst
        .mockResolvedValue(
          null,
        );
    });

    it(
      "rejects accounts without a STUDENT or TEACHER role",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue({
            id:
              "admin-only",

            role:
              null,

            accountStatus:
              "ACTIVE",

            studentProfile:
              null,

            teacherProfile:
              null,
          });

        await expect(
          listSpeakingSessions(
            "admin-only",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                asOf,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionReadForbiddenError,
        );

        expect(
          mocks.findMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects an inactive account",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue({
            ...studentAccess(),

            accountStatus:
              "SUSPENDED",
          });

        await expect(
          listSpeakingSessions(
            "student-user",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionReadForbiddenError,
        );
      },
    );

    it(
      "treats STUDENT without StudentProfile as an invariant failure",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue({
            ...studentAccess(),

            studentProfile:
              null,
          });

        await expect(
          listSpeakingSessions(
            "student-user",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionReadInvariantError,
        );
      },
    );

    it(
      "treats TEACHER without TeacherProfile as an invariant failure",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue({
            ...teacherAccess(),

            teacherProfile:
              null,
          });

        await expect(
          listSpeakingSessions(
            "teacher-user",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionReadInvariantError,
        );
      },
    );

    it(
      "queries student upcoming sessions in ascending keyset order",
      async () => {
        await listSpeakingSessions(
          "student-user",
          {
            bucket:
              "upcoming",

            limit:
              20,
          },
          {
            now:
              asOf,
          },
        );

        const call =
          mocks.findMany
            .mock.calls[0][0];

        expect(
          call.take,
        ).toBe(
          21,
        );

        expect(
          call.orderBy,
        ).toEqual([
          {
            startAt:
              "asc",
          },
          {
            id:
              "asc",
          },
        ]);

        expect(
          call.where,
        ).toEqual({
          AND: [
            {
              studentUserId:
                "student-user",
            },
            {
              status:
                "SCHEDULED",

              endAt: {
                gt:
                  asOf,
              },
            },
          ],
        });
      },
    );

    it(
      "queries teacher history in descending keyset order",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue(
            teacherAccess(),
          );

        await listSpeakingSessions(
          "teacher-user",
          {
            bucket:
              "history",

            limit:
              20,
          },
          {
            now:
              asOf,
          },
        );

        const call =
          mocks.findMany
            .mock.calls[0][0];

        expect(
          call.orderBy,
        ).toEqual([
          {
            startAt:
              "desc",
          },
          {
            id:
              "desc",
          },
        ]);

        expect(
          call.where.AND[0],
        ).toEqual({
          teacherProfileId:
            "teacher-profile",
        });

        expect(
          call.where.AND[1],
        ).toEqual({
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
        });
      },
    );

    it(
      "fetches limit plus one and derives a next cursor",
      async () => {
        mocks.findMany
          .mockResolvedValue([
            studentViewerRow({
              id:
                "session-1",

              startAt:
                new Date(
                  "2026-08-13T10:00:00.000Z",
                ),
            }),

            studentViewerRow({
              id:
                "session-2",

              startAt:
                new Date(
                  "2026-08-13T11:00:00.000Z",
                ),
            }),

            studentViewerRow({
              id:
                "session-3",

              startAt:
                new Date(
                  "2026-08-13T12:00:00.000Z",
                ),
            }),
          ]);

        const result =
          await listSpeakingSessions(
            "student-user",
            {
              bucket:
                "upcoming",

              limit:
                2,
            },
            {
              now:
                asOf,
            },
          );

        expect(
          result.items,
        ).toHaveLength(
          2,
        );

        expect(
          result.hasMore,
        ).toBe(
          true,
        );

        expect(
          result.nextCursor,
        ).not.toBeNull();

        const decoded =
          decodeSessionReadCursor(
            result.nextCursor!,
            "upcoming",
          );

        expect(
          decoded.asOf,
        ).toEqual(
          asOf,
        );

        expect(
          decoded.startAt,
        ).toEqual(
          new Date(
            "2026-08-13T11:00:00.000Z",
          ),
        );

        expect(
          decoded.id,
        ).toBe(
          "session-2",
        );
      },
    );

    it(
      "returns no cursor when there is no next page",
      async () => {
        mocks.findMany
          .mockResolvedValue([
            studentViewerRow(),
          ]);

        const result =
          await listSpeakingSessions(
            "student-user",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                asOf,
            },
          );

        expect(
          result.hasMore,
        ).toBe(
          false,
        );

        expect(
          result.nextCursor,
        ).toBeNull();
      },
    );

    it(
      "uses the cursor asOf rather than wall-clock now on later pages",
      async () => {
        const pinnedAsOf =
          new Date(
            "2026-08-12T09:00:00.000Z",
          );

        const cursor =
          encodeSessionReadCursor({
            bucket:
              "upcoming",

            asOf:
              pinnedAsOf,

            startAt:
              new Date(
                "2026-08-13T10:00:00.000Z",
              ),

            id:
              "session-20",
          });

        await listSpeakingSessions(
          "student-user",
          {
            bucket:
              "upcoming",

            limit:
              20,

            cursor,
          },
          {
            now:
              asOf,
          },
        );

        const call =
          mocks.findMany
            .mock.calls[0][0];

        expect(
          call.where.AND[1],
        ).toEqual({
          status:
            "SCHEDULED",

          endAt: {
            gt:
              pinnedAsOf,
          },
        });

        expect(
          call.where.AND[2],
        ).toEqual({
          OR: [
            {
              startAt: {
                gt:
                  new Date(
                    "2026-08-13T10:00:00.000Z",
                  ),
              },
            },
            {
              startAt:
                new Date(
                  "2026-08-13T10:00:00.000Z",
                ),

              id: {
                gt:
                  "session-20",
              },
            },
          ],
        });
      },
    );

    it(
      "uses reverse keyset boundaries for history",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue(
            teacherAccess(),
          );

        const cursor =
          encodeSessionReadCursor({
            bucket:
              "history",

            asOf,

            startAt:
              new Date(
                "2026-08-10T10:00:00.000Z",
              ),

            id:
              "session-20",
          });

        await listSpeakingSessions(
          "teacher-user",
          {
            bucket:
              "history",

            limit:
              20,

            cursor,
          },
        );

        const call =
          mocks.findMany
            .mock.calls[0][0];

        expect(
          call.where.AND[2],
        ).toEqual({
          OR: [
            {
              startAt: {
                lt:
                  new Date(
                    "2026-08-10T10:00:00.000Z",
                  ),
              },
            },
            {
              startAt:
                new Date(
                  "2026-08-10T10:00:00.000Z",
                ),

              id: {
                lt:
                  "session-20",
              },
            },
          ],
        });
      },
    );

    it(
      "rejects a cursor from a different bucket",
      async () => {
        const cursor =
          encodeSessionReadCursor({
            bucket:
              "upcoming",

            asOf,

            startAt:
              asOf,

            id:
              "session-1",
          });

        await expect(
          listSpeakingSessions(
            "student-user",
            {
              bucket:
                "history",

              limit:
                20,

              cursor,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionReadCursorError,
        );

        expect(
          mocks.findMany,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "uses a teacher-only counterparty projection for student viewers",
      async () => {
        mocks.findMany
          .mockResolvedValue([
            studentViewerRow(),
          ]);

        const result =
          await listSpeakingSessions(
            "student-user",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                asOf,
            },
          );

        expect(
          result.items[0],
        ).toEqual({
          id:
            "session-1",

          startAt:
            new Date(
              "2026-08-13T10:00:00.000Z",
            ),

          endAt:
            new Date(
              "2026-08-13T10:15:00.000Z",
            ),

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
        });

        const select =
          mocks.findMany
            .mock.calls[0][0]
            .select;

        expect(
          select.teacherProfile,
        ).toBeDefined();

        expect(
          select.studentUser,
        ).toBeUndefined();
      },
    );

    it(
      "uses a student-only counterparty projection for teacher viewers",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue(
            teacherAccess(),
          );

        mocks.findMany
          .mockResolvedValue([
            teacherViewerRow(),
          ]);

        const result =
          await listSpeakingSessions(
            "teacher-user",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                asOf,
            },
          );

        expect(
          result.items[0]
            .counterparty,
        ).toEqual({
          type:
            "STUDENT",

          userId:
            "student-user",

          name:
            "Student Name",

          image:
            null,
        });

        const select =
          mocks.findMany
            .mock.calls[0][0]
            .select;

        expect(
          select.studentUser,
        ).toBeDefined();

        expect(
          select.teacherProfile,
        ).toBeUndefined();
      },
    );

    it(
      "never selects cancellation reason for session reads",
      async () => {
        await listSpeakingSessions(
          "student-user",
          {
            bucket:
              "history",

            limit:
              20,
          },
          {
            now:
              asOf,
          },
        );

        const cancellationSelect =
          mocks.findMany
            .mock.calls[0][0]
            .select
            .cancellation
            .select;

        expect(
          cancellationSelect,
        ).toEqual({
          actorType:
            true,

          cancelledAt:
            true,
        });

        expect(
          cancellationSelect.reason,
        ).toBeUndefined();
      },
    );

    it(
      "treats CANCELLED without cancellation history as an invariant failure",
      async () => {
        mocks.findMany
          .mockResolvedValue([
            studentViewerRow({
              status:
                "CANCELLED",

              cancellation:
                null,
            }),
          ]);

        await expect(
          listSpeakingSessions(
            "student-user",
            {
              bucket:
                "history",

              limit:
                20,
            },
            {
              now:
                asOf,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionReadInvariantError,
        );
      },
    );

    it(
      "treats cancellation history on a non-CANCELLED session as an invariant failure",
      async () => {
        mocks.findMany
          .mockResolvedValue([
            studentViewerRow({
              cancellation: {
                actorType:
                  "STUDENT",

                cancelledAt:
                  asOf,
              },
            }),
          ]);

        await expect(
          listSpeakingSessions(
            "student-user",
            {
              bucket:
                "upcoming",

              limit:
                20,
            },
            {
              now:
                asOf,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionReadInvariantError,
        );
      },
    );

    it(
      "loads student-owned detail without revealing existence of other sessions",
      async () => {
        mocks.findFirst
          .mockResolvedValue(
            studentViewerRow(),
          );

        const result =
          await getSpeakingSessionForViewer(
            "student-user",
            "session-1",
          );

        expect(
          result.id,
        ).toBe(
          "session-1",
        );

        expect(
          mocks.findFirst,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id:
                "session-1",

              studentUserId:
                "student-user",
            },
          }),
        );
      },
    );

    it(
      "loads teacher-owned detail by teacherProfileId",
      async () => {
        mocks.getUserAccessContext
          .mockResolvedValue(
            teacherAccess(),
          );

        mocks.findFirst
          .mockResolvedValue(
            teacherViewerRow(),
          );

        await getSpeakingSessionForViewer(
          "teacher-user",
          "session-1",
        );

        expect(
          mocks.findFirst,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id:
                "session-1",

              teacherProfileId:
                "teacher-profile",
            },
          }),
        );
      },
    );

    it(
      "returns the same not-found domain error for absent or unowned detail",
      async () => {
        mocks.findFirst
          .mockResolvedValue(
            null,
          );

        await expect(
          getSpeakingSessionForViewer(
            "student-user",
            "session-private",
          ),
        ).rejects.toBeInstanceOf(
          SessionReadTargetNotFoundError,
        );
      },
    );

    it(
      "rejects limits above the hard maximum before querying sessions",
      async () => {
        await expect(
          listSpeakingSessions(
            "student-user",
            {
              bucket:
                "upcoming",

              limit:
                101,
            },
          ),
        ).rejects.toBeDefined();

        expect(
          mocks.findMany,
        ).not.toHaveBeenCalled();
      },
    );
  },
);

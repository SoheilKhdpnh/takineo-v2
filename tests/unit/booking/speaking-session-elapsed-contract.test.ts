import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getUserAccessContext: vi.fn(),

  findMany: vi.fn(),
  findFirst: vi.fn(),

  update: vi.fn(),
  updateMany: vi.fn(),
}));

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

        update:
          mocks.update,

        updateMany:
          mocks.updateMany,
      },
    },
  }),
);

import {
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

function elapsedScheduledRow() {
  return {
    id:
      "elapsed-session",

    startAt:
      new Date(
        "2026-08-12T09:00:00.000Z",
      ),

    endAt:
      new Date(
        "2026-08-12T09:15:00.000Z",
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
          null,
      },
    },

    cancellation:
      null,
  };
}

describe(
  "Wave 2 elapsed-session read contract",
  () => {
    beforeEach(() => {
      mocks.getUserAccessContext
        .mockReset();

      mocks.findMany
        .mockReset();

      mocks.findFirst
        .mockReset();

      mocks.update
        .mockReset();

      mocks.updateMany
        .mockReset();

      mocks.getUserAccessContext
        .mockResolvedValue(
          studentAccess(),
        );

      mocks.findMany
        .mockResolvedValue([
          elapsedScheduledRow(),
        ]);

      mocks.findFirst
        .mockResolvedValue(
          null,
        );
    });

    it(
      "treats elapsed time as a read-model fact without completing the booking",
      async () => {
        const result =
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

        expect(
          result.items,
        ).toHaveLength(1);

        expect(
          result.items[0].endAt.getTime(),
        ).toBeLessThanOrEqual(
          asOf.getTime(),
        );

        expect(
          result.items[0].status,
        ).toBe(
          "SCHEDULED",
        );

        expect(
          mocks.update,
        ).not.toHaveBeenCalled();

        expect(
          mocks.updateMany,
        ).not.toHaveBeenCalled();
      },
    );
  },
);

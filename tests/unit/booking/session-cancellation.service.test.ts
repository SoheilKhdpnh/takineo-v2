import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => {
    const tx = {
      $executeRaw:
        vi.fn(),

      $queryRaw:
        vi.fn(),

      user: {
        findUnique:
          vi.fn(),
      },

      speakingSession: {
        findUnique:
          vi.fn(),
      },

      speakingSessionCancellation: {
        create:
          vi.fn(),
      },
    };

    const prisma = {
      $transaction:
        vi.fn(),
    };

    return {
      prisma,
      tx,
    };
  });

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma:
      mocks.prisma,
  }),
);

import {
  SessionCancellationCutoffError,
  SessionCancellationForbiddenError,
  SessionCancellationInvariantError,
  SessionCancellationTargetNotFoundError,
} from "@/lib/errors/session-cancellation-errors";
import {
  cancelSpeakingSessionAsAdmin,
  cancelSpeakingSessionAsStudent,
  cancelSpeakingSessionAsTeacher,
} from "@/lib/services/session-cancellation.service";

const SESSION_ID =
  "speaking-session-1";

const STUDENT_ID =
  "student-user-1";

const OTHER_STUDENT_ID =
  "student-user-2";

const TEACHER_ID =
  "teacher-user-1";

const OTHER_TEACHER_ID =
  "teacher-user-2";

const ADMIN_ID =
  "admin-user-1";

const START_AT =
  new Date(
    "2026-08-20T08:00:00.000Z",
  );

const END_AT =
  new Date(
    "2026-08-20T08:15:00.000Z",
  );

const CREATED_AT =
  new Date(
    "2026-08-10T08:00:00.000Z",
  );

const UPDATED_AT =
  new Date(
    "2026-08-10T08:00:01.000Z",
  );

const CANCELLED_AT =
  new Date(
    "2026-08-10T08:00:02.000Z",
  );

const activeStudent = {
  role:
    "STUDENT",

  accountStatus:
    "ACTIVE",

  adminAccess:
    null,
};

const activeTeacher = {
  role:
    "TEACHER",

  accountStatus:
    "ACTIVE",

  adminAccess:
    null,
};

const reviewerAdmin = {
  role:
    "STUDENT",

  accountStatus:
    "ACTIVE",

  adminAccess: {
    permission:
      "REVIEWER",

    revokedAt:
      null,
  },
};

const superAdmin = {
  role:
    "STUDENT",

  accountStatus:
    "ACTIVE",

  adminAccess: {
    permission:
      "SUPER_ADMIN",

    revokedAt:
      null,
  },
};

const cancellationHistory = {
  id:
    "cancellation-1",

  sessionId:
    SESSION_ID,

  actorType:
    "STUDENT",

  actorUserId:
    STUDENT_ID,

  reason:
    null,

  cancelledAt:
    CANCELLED_AT,

  createdAt:
    CANCELLED_AT,
};

function makeSession(
  input: {
    status?:
      | "SCHEDULED"
      | "COMPLETED"
      | "CANCELLED";

    cancellation?:
      typeof cancellationHistory |
      null;

    studentUserId?:
      string;

    teacherUserId?:
      string;

    startAt?:
      Date;
  } = {},
) {
  return {
    id:
      SESSION_ID,

    teacherProfileId:
      "teacher-profile-1",

    studentUserId:
      input.studentUserId ??
      STUDENT_ID,

    startAt:
      input.startAt ??
      START_AT,

    endAt:
      END_AT,

    status:
      input.status ??
      "SCHEDULED",

    createdAt:
      CREATED_AT,

    updatedAt:
      UPDATED_AT,

    teacherProfile: {
      userId:
        input.teacherUserId ??
        TEACHER_ID,
    },

    cancellation:
      input.cancellation ??
      null,
  };
}

const transitionedRow = {
  id:
    SESSION_ID,

  teacherProfileId:
    "teacher-profile-1",

  studentUserId:
    STUDENT_ID,

  startAt:
    START_AT,

  endAt:
    END_AT,

  createdAt:
    CREATED_AT,

  updatedAt:
    CANCELLED_AT,

  cancelledAt:
    CANCELLED_AT,
};

beforeEach(() => {
  vi.clearAllMocks();

  mocks.prisma
    .$transaction
    .mockImplementation(
      async (
        work:
          (
            tx:
              typeof mocks.tx,
          ) =>
            Promise<unknown>,
      ) =>
        work(
          mocks.tx,
        ),
    );

  mocks.tx
    .$executeRaw
    .mockResolvedValue(
      0,
    );

  mocks.tx
    .user
    .findUnique
    .mockResolvedValue(
      activeStudent,
    );

  mocks.tx
    .speakingSession
    .findUnique
    .mockResolvedValue(
      makeSession(),
    );

  mocks.tx
    .$queryRaw
    .mockResolvedValue([
      transitionedRow,
    ]);

  mocks.tx
    .speakingSessionCancellation
    .create
    .mockResolvedValue(
      cancellationHistory,
    );
});

describe(
  "session cancellation service",
  () => {
    test(
      "student cancellation atomically returns CANCELLED with durable attribution",
      async () => {
        const result =
          await cancelSpeakingSessionAsStudent(
            STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          );

        expect(
          result,
        ).toMatchObject({
          session: {
            id:
              SESSION_ID,

            status:
              "CANCELLED",
          },

          cancellation: {
            sessionId:
              SESSION_ID,

            actorType:
              "STUDENT",

            actorUserId:
              STUDENT_ID,
          },

          alreadyCancelled:
            false,
        });

        expect(
          mocks.tx
            .speakingSessionCancellation
            .create,
        ).toHaveBeenCalledWith({
          data: {
            sessionId:
              SESSION_ID,

            actorType:
              "STUDENT",

            actorUserId:
              STUDENT_ID,

            reason:
              null,

            cancelledAt:
              CANCELLED_AT,
          },

          select:
            expect.any(
              Object,
            ),
        });

        /*
         * Session advisory lock must be the
         * first database operation.
         */
        expect(
          mocks.tx
            .$executeRaw
            .mock
            .invocationCallOrder[0],
        ).toBeLessThan(
          mocks.tx
            .speakingSession
            .findUnique
            .mock
            .invocationCallOrder[0]!,
        );
      },
    );

    test(
      "repeated cancellation returns the original immutable history",
      async () => {
        mocks.tx
          .speakingSession
          .findUnique
          .mockResolvedValue(
            makeSession({
              status:
                "CANCELLED",

              cancellation:
                cancellationHistory,
            }),
          );

        const result =
          await cancelSpeakingSessionAsStudent(
            STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          );

        expect(
          result.alreadyCancelled,
        ).toBe(
          true,
        );

        expect(
          result.cancellation,
        ).toEqual(
          cancellationHistory,
        );

        expect(
          mocks.tx
            .$queryRaw,
        ).not.toHaveBeenCalled();

        expect(
          mocks.tx
            .speakingSessionCancellation
            .create,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "CANCELLED without cancellation history is an invariant failure",
      async () => {
        mocks.tx
          .speakingSession
          .findUnique
          .mockResolvedValue(
            makeSession({
              status:
                "CANCELLED",

              cancellation:
                null,
            }),
          );

        await expect(
          cancelSpeakingSessionAsStudent(
            STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationInvariantError,
        );
      },
    );

    test(
      "COMPLETED session cannot be cancelled",
      async () => {
        mocks.tx
          .speakingSession
          .findUnique
          .mockResolvedValue(
            makeSession({
              status:
                "COMPLETED",
            }),
          );

        await expect(
          cancelSpeakingSessionAsStudent(
            STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          ),
        ).rejects.toMatchObject({
          name:
            "SessionCancellationStateError",

          state:
            "COMPLETED",
        });
      },
    );

    test(
      "student inside the 120-minute cutoff is rejected using database time",
      async () => {
        mocks.tx
          .$queryRaw
          .mockResolvedValueOnce(
            [],
          )
          .mockResolvedValueOnce([
            {
              status:
                "SCHEDULED",

              startAt:
                new Date(
                  "2026-08-10T09:59:59.999Z",
                ),

              databaseNow:
                new Date(
                  "2026-08-10T08:00:00.000Z",
                ),
            },
          ]);

        await expect(
          cancelSpeakingSessionAsStudent(
            STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationCutoffError,
        );
      },
    );

    test(
      "teacher may cancel inside the student cutoff",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue(
            activeTeacher,
          );

        const result =
          await cancelSpeakingSessionAsTeacher(
            TEACHER_ID,
            {
              sessionId:
                SESSION_ID,

              reason:
                "Unexpected connection failure",
            },
          );

        expect(
          result.alreadyCancelled,
        ).toBe(
          false,
        );

        expect(
          mocks.tx
            .speakingSessionCancellation
            .create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                actorType:
                  "TEACHER",

                actorUserId:
                  TEACHER_ID,

                reason:
                  "Unexpected connection failure",
              }),
          }),
        );
      },
    );

    test(
      "teacher cannot cancel after the session has started",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue(
            activeTeacher,
          );

        mocks.tx
          .$queryRaw
          .mockResolvedValueOnce(
            [],
          )
          .mockResolvedValueOnce([
            {
              status:
                "SCHEDULED",

              startAt:
                new Date(
                  "2026-08-10T07:45:00.000Z",
                ),

              databaseNow:
                new Date(
                  "2026-08-10T08:00:00.000Z",
                ),
            },
          ]);

        await expect(
          cancelSpeakingSessionAsTeacher(
            TEACHER_ID,
            {
              sessionId:
                SESSION_ID,

              reason:
                "Technical issue",
            },
          ),
        ).rejects.toMatchObject({
          name:
            "SessionCancellationStateError",

          state:
            "STARTED",
        });
      },
    );

    test(
      "unrelated student receives not-found semantics",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue(
            activeStudent,
          );

        await expect(
          cancelSpeakingSessionAsStudent(
            OTHER_STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationTargetNotFoundError,
        );
      },
    );

    test(
      "unrelated teacher receives not-found semantics",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue(
            activeTeacher,
          );

        await expect(
          cancelSpeakingSessionAsTeacher(
            OTHER_TEACHER_ID,
            {
              sessionId:
                SESSION_ID,

              reason:
                "Cannot teach",
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationTargetNotFoundError,
        );
      },
    );

    test(
      "REVIEWER cannot administratively cancel sessions",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue(
            reviewerAdmin,
          );

        await expect(
          cancelSpeakingSessionAsAdmin(
            ADMIN_ID,
            {
              sessionId:
                SESSION_ID,

              reason:
                "Administrative intervention",
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationForbiddenError,
        );
      },
    );

    test(
      "SUPER_ADMIN can administratively cancel sessions",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue(
            superAdmin,
          );

        const result =
          await cancelSpeakingSessionAsAdmin(
            ADMIN_ID,
            {
              sessionId:
                SESSION_ID,

              reason:
                "Administrative intervention",
            },
          );

        expect(
          result.session.status,
        ).toBe(
          "CANCELLED",
        );

        expect(
          mocks.tx
            .speakingSessionCancellation
            .create,
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            data:
              expect.objectContaining({
                actorType:
                  "ADMIN",

                actorUserId:
                  ADMIN_ID,

                reason:
                  "Administrative intervention",
              }),
          }),
        );
      },
    );

    test(
      "inactive actor cannot cancel",
      async () => {
        mocks.tx
          .user
          .findUnique
          .mockResolvedValue({
            ...activeStudent,

            accountStatus:
              "SUSPENDED",
          });

        await expect(
          cancelSpeakingSessionAsStudent(
            STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationForbiddenError,
        );
      },
    );

    test(
      "missing session returns not found",
      async () => {
        mocks.tx
          .speakingSession
          .findUnique
          .mockResolvedValue(
            null,
          );

        await expect(
          cancelSpeakingSessionAsStudent(
            STUDENT_ID,
            {
              sessionId:
                SESSION_ID,
            },
          ),
        ).rejects.toBeInstanceOf(
          SessionCancellationTargetNotFoundError,
        );
      },
    );

    test(
      "teacher cancellation requires a reason before entering the transaction",
      async () => {
        await expect(
          cancelSpeakingSessionAsTeacher(
            TEACHER_ID,
            {
              sessionId:
                SESSION_ID,

              reason:
                "",
            },
          ),
        ).rejects.toBeDefined();

        expect(
          mocks.prisma
            .$transaction,
        ).not.toHaveBeenCalled();
      },
    );

    test(
      "admin cancellation requires a reason before entering the transaction",
      async () => {
        await expect(
          cancelSpeakingSessionAsAdmin(
            ADMIN_ID,
            {
              sessionId:
                SESSION_ID,

              reason:
                "   ",
            },
          ),
        ).rejects.toBeDefined();

        expect(
          mocks.prisma
            .$transaction,
        ).not.toHaveBeenCalled();
      },
    );
  },
);

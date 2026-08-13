import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  ADMIN_TEACHER_APPLICATION_STATES,
  createAdminServiceFixtures,
} from "@/tests/support/admin-service-fixtures";
import {
  createTestPrismaClient,
} from "@/tests/support/test-prisma-client";

const fixtures =
  createAdminServiceFixtures(
    "authorization",
  );

const IDS = {
  student:
    fixtures.id(
      "student",
    ),

  reviewer:
    fixtures.id(
      "reviewer",
    ),

  superAdmin:
    fixtures.id(
      "super_admin",
    ),

  suspendedReviewer:
    fixtures.id(
      "suspended_reviewer",
    ),

  disabledSuperAdmin:
    fixtures.id(
      "disabled_super_admin",
    ),

  revokedReviewer:
    fixtures.id(
      "revoked_reviewer",
    ),

  revokedSuperAdmin:
    fixtures.id(
      "revoked_super_admin",
    ),
} as const;

const TEACHER_STATES =
  ADMIN_TEACHER_APPLICATION_STATES;

type TeacherState =
  (typeof TEACHER_STATES)[number];

function teacherUserId(
  state:
    TeacherState,
) {
  return fixtures.id(
    `teacher_${state.toLowerCase()}`,
  );
}

let applicationPrisma:
  ReturnType<
    typeof createTestPrismaClient
  > | null =
    null;

let requireAdminAccess:
  typeof import(
    "@/lib/auth/admin-access"
  ).requireAdminAccess;

let getCurrentAdminCapabilities:
  typeof import(
    "@/lib/auth/admin-access"
  ).getCurrentAdminCapabilities;

let listPendingTeacherApplications:
  typeof import(
    "@/lib/services/admin-review.service"
  ).listPendingTeacherApplications;

let setTeacherSuspension:
  typeof import(
    "@/lib/services/admin-review.service"
  ).setTeacherSuspension;

let AdminForbiddenError:
  typeof import(
    "@/lib/errors/admin-errors"
  ).AdminForbiddenError;

let AdminTargetNotFoundError:
  typeof import(
    "@/lib/errors/admin-errors"
  ).AdminTargetNotFoundError;

async function seedFixtures():
  Promise<void> {
  await fixtures.createUser({
    key:
      "student",
    role:
      "STUDENT",
  });

  for (
    const state of
    TEACHER_STATES
  ) {
    await fixtures.createTeacherApplicant({
      key:
        `teacher_${state.toLowerCase()}`,
      applicationStatus:
        state,
    });
  }

  await fixtures.createAdministrator({
    key:
      "reviewer",
    productRole:
      "TEACHER",
    permission:
      "REVIEWER",
    teacherApplicationStatus:
      "DRAFT",
  });

  await fixtures.createAdministrator({
    key:
      "super_admin",
    productRole:
      "STUDENT",
    permission:
      "SUPER_ADMIN",
  });

  await fixtures.createAdministrator({
    key:
      "suspended_reviewer",
    productRole:
      "STUDENT",
    accountStatus:
      "SUSPENDED",
    permission:
      "REVIEWER",
  });

  await fixtures.createAdministrator({
    key:
      "disabled_super_admin",
    productRole:
      "TEACHER",
    accountStatus:
      "DISABLED",
    permission:
      "SUPER_ADMIN",
    teacherApplicationStatus:
      "APPROVED",
  });

  await fixtures.createAdministrator({
    key:
      "revoked_reviewer",
    productRole:
      "STUDENT",
    permission:
      "REVIEWER",
    revoked:
      true,
  });

  await fixtures.createAdministrator({
    key:
      "revoked_super_admin",
    productRole:
      "TEACHER",
    permission:
      "SUPER_ADMIN",
    revoked:
      true,
    teacherApplicationStatus:
      "APPROVED",
  });
}

describe(
  "Wave 1 administrative authorization",
  () => {
    beforeAll(
      async () => {
        await fixtures.connect(
          "takineo-wave1-admin-authorization-test",
        );
        await seedFixtures();

        applicationPrisma =
          createTestPrismaClient();

        vi.resetModules();

        vi.doMock(
          "@/lib/db/prisma",
          () => ({
            prisma:
              applicationPrisma,
          }),
        );

        const errors =
          await import(
            "@/lib/errors/admin-errors"
          );

        AdminForbiddenError =
          errors.AdminForbiddenError;

        AdminTargetNotFoundError =
          errors.AdminTargetNotFoundError;

        const access =
          await import(
            "@/lib/auth/admin-access"
          );

        requireAdminAccess =
          access.requireAdminAccess;

        getCurrentAdminCapabilities =
          access.getCurrentAdminCapabilities;

        const review =
          await import(
            "@/lib/services/admin-review.service"
          );

        listPendingTeacherApplications =
          review.listPendingTeacherApplications;

        setTeacherSuspension =
          review.setTeacherSuspension;
      },
    );

    afterAll(
      async () => {
        try {
          await fixtures.dispose();
        } finally {
          try {
            if (
              applicationPrisma
            ) {
              await applicationPrisma.$disconnect();
              applicationPrisma =
                null;
            }
          } finally {
            vi.doUnmock(
              "@/lib/db/prisma",
            );

            vi.resetModules();
          }
        }
      },
    );

    test("a missing user cannot enter an administrative service", async () => {
      await expect(
        listPendingTeacherApplications(
          fixtures.id(
            "missing_user",
          ),
          {
            limit: 1,
          },
        ),
      ).rejects.toBeInstanceOf(
        AdminForbiddenError,
      );
    });

    test("a student product role does not grant administrative review", async () => {
      await expect(
        listPendingTeacherApplications(
          IDS.student,
          {
            limit: 1,
          },
        ),
      ).rejects.toBeInstanceOf(
        AdminForbiddenError,
      );
    });

    test.each(
      TEACHER_STATES,
    )(
      "a non-admin teacher in %s remains denied",
      async (state) => {
        await expect(
          listPendingTeacherApplications(
            teacherUserId(
              state,
            ),
            {
              limit: 1,
            },
          ),
        ).rejects.toBeInstanceOf(
          AdminForbiddenError,
        );
      },
    );

    test.each([
      [
        "suspended REVIEWER",
        IDS.suspendedReviewer,
      ],
      [
        "disabled SUPER_ADMIN",
        IDS.disabledSuperAdmin,
      ],
      [
        "revoked REVIEWER",
        IDS.revokedReviewer,
      ],
      [
        "revoked SUPER_ADMIN",
        IDS.revokedSuperAdmin,
      ],
    ] as const)(
      "a %s remains denied",
      async (
        _label,
        userId,
      ) => {
        await expect(
          getCurrentAdminCapabilities(
            userId,
          ),
        ).rejects.toBeInstanceOf(
          AdminForbiddenError,
        );
      },
    );

    test("a REVIEWER may be a teacher product user but receives review-only authority", async () => {
      await expect(
        listPendingTeacherApplications(
          IDS.reviewer,
          {
            limit: 1,
          },
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          applications:
            expect.any(
              Array,
            ),
        }),
      );

      await expect(
        getCurrentAdminCapabilities(
          IDS.reviewer,
        ),
      ).resolves.toEqual({
        userId:
          IDS.reviewer,
        permission:
          "REVIEWER",
        capabilities: {
          reviewTeacherApplications:
            true,
          moderateTeachers:
            false,
          moderateAccounts:
            false,
          manageAdminAccess:
            false,
          manageSessions:
            false,
        },
      });
    });

    test("a SUPER_ADMIN may be a student product user and receives moderation authority", async () => {
      await expect(
        listPendingTeacherApplications(
          IDS.superAdmin,
          {
            limit: 1,
          },
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          applications:
            expect.any(
              Array,
            ),
        }),
      );

      await expect(
        getCurrentAdminCapabilities(
          IDS.superAdmin,
        ),
      ).resolves.toEqual({
        userId:
          IDS.superAdmin,
        permission:
          "SUPER_ADMIN",
        capabilities: {
          reviewTeacherApplications:
            true,
          moderateTeachers:
            true,
          moderateAccounts:
            true,
          manageAdminAccess:
            true,
          manageSessions:
            true,
        },
      });
    });

    test("review services deny REVIEWER moderation before target lookup", async () => {
      await expect(
        setTeacherSuspension(
          IDS.reviewer,
          fixtures.id(
            "missing_profile",
          ),
          true,
          {
            reviewCycle: 1,
            reason:
              "Confirmed policy violation.",
          },
        ),
      ).rejects.toBeInstanceOf(
        AdminForbiddenError,
      );
    });

    test("review services allow SUPER_ADMIN moderation authorization before target lookup", async () => {
      await expect(
        setTeacherSuspension(
          IDS.superAdmin,
          fixtures.id(
            "missing_profile",
          ),
          true,
          {
            reviewCycle: 1,
            reason:
              "Confirmed policy violation.",
          },
        ),
      ).rejects.toBeInstanceOf(
        AdminTargetNotFoundError,
      );
    });

    test("session-management capability remains super-admin-only", async () => {
      await expect(
        requireAdminAccess(
          IDS.reviewer,
          "MANAGE_SESSIONS",
        ),
      ).rejects.toBeInstanceOf(
        AdminForbiddenError,
      );

      await expect(
        requireAdminAccess(
          IDS.superAdmin,
          "MANAGE_SESSIONS",
        ),
      ).resolves.toEqual({
        userId:
          IDS.superAdmin,
        permission:
          "SUPER_ADMIN",
      });
    });
  },
);

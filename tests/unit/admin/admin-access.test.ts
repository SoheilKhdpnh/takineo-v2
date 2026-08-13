import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    findUnique:
      vi.fn(),
  }));

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma: {
      user: {
        findUnique:
          mocks.findUnique,
      },
    },
  }),
);

import {
  adminPermissionHasCapability,
  getCurrentAdminCapabilities,
  requireAdminAccess,
} from "@/lib/auth/admin-access";
import {
  AdminForbiddenError,
} from "@/lib/errors/admin-errors";

type AccountStatus =
  | "ACTIVE"
  | "SUSPENDED"
  | "DISABLED";

type Permission =
  | "REVIEWER"
  | "SUPER_ADMIN";

function adminUser(
  input: {
    accountStatus?:
      AccountStatus;

    permission?:
      Permission;

    revokedAt?:
      Date | null;
  } = {},
) {
  return {
    accountStatus:
      input.accountStatus ??
      "ACTIVE",

    adminAccess:
      input.permission
        ? {
            permission:
              input.permission,

            revokedAt:
              input.revokedAt ??
              null,
          }
        : null,
  };
}

describe(
  "admin permission capabilities",
  () => {
    it.each([
      [
        "REVIEWER",
        "REVIEW",
        true,
      ],
      [
        "REVIEWER",
        "MODERATE_TEACHER",
        false,
      ],
      [
        "REVIEWER",
        "MANAGE_SESSIONS",
        false,
      ],
      [
        "SUPER_ADMIN",
        "REVIEW",
        true,
      ],
      [
        "SUPER_ADMIN",
        "MODERATE_TEACHER",
        true,
      ],
      [
        "SUPER_ADMIN",
        "MANAGE_SESSIONS",
        true,
      ],
    ] as const)(
      "%s requesting %s resolves to %s",
      (
        permission,
        capability,
        expected,
      ) => {
        expect(
          adminPermissionHasCapability(
            permission,
            capability,
          ),
        ).toBe(expected);
      },
    );
  },
);

describe(
  "requireAdminAccess",
  () => {
    beforeEach(() => {
      mocks.findUnique.mockReset();
    });

    it("denies a missing user by default", async () => {
      mocks.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        requireAdminAccess(
          "missing-user",
        ),
      ).rejects.toBeInstanceOf(
        AdminForbiddenError,
      );
    });

    it("denies an active user without administrative access", async () => {
      mocks.findUnique.mockResolvedValue(
        adminUser(),
      );

      await expect(
        requireAdminAccess(
          "ordinary-user",
        ),
      ).rejects.toBeInstanceOf(
        AdminForbiddenError,
      );
    });

    it.each([
      "SUSPENDED",
      "DISABLED",
    ] as const)(
      "denies a %s administrator",
      async (accountStatus) => {
        mocks.findUnique.mockResolvedValue(
          adminUser({
            accountStatus,
            permission:
              "SUPER_ADMIN",
          }),
        );

        await expect(
          requireAdminAccess(
            `admin-${accountStatus}`,
          ),
        ).rejects.toBeInstanceOf(
          AdminForbiddenError,
        );
      },
    );

    it.each([
      "REVIEWER",
      "SUPER_ADMIN",
    ] as const)(
      "denies a revoked %s",
      async (permission) => {
        mocks.findUnique.mockResolvedValue(
          adminUser({
            permission,
            revokedAt:
              new Date(
                "2026-08-13T00:00:00.000Z",
              ),
          }),
        );

        await expect(
          requireAdminAccess(
            `revoked-${permission}`,
          ),
        ).rejects.toBeInstanceOf(
          AdminForbiddenError,
        );
      },
    );

    it("authorizes review without reading the product role", async () => {
      mocks.findUnique.mockResolvedValue(
        adminUser({
          permission:
            "REVIEWER",
        }),
      );

      await expect(
        requireAdminAccess(
          "reviewer-user",
        ),
      ).resolves.toEqual({
        userId:
          "reviewer-user",
        permission:
          "REVIEWER",
      });

      const query =
        mocks.findUnique.mock.calls[0]
          ?.[0];

      expect(query).toEqual({
        where: {
          id:
            "reviewer-user",
        },
        select: {
          accountStatus:
            true,
          adminAccess: {
            select: {
              permission:
                true,
              revokedAt:
                true,
            },
          },
        },
      });

      expect(
        query?.select,
      ).not.toHaveProperty(
        "role",
      );
    });

    it("denies a REVIEWER the privileged teacher-moderation capability", async () => {
      mocks.findUnique.mockResolvedValue(
        adminUser({
          permission:
            "REVIEWER",
        }),
      );

      await expect(
        requireAdminAccess(
          "reviewer-user",
          "MODERATE_TEACHER",
        ),
      ).rejects.toBeInstanceOf(
        AdminForbiddenError,
      );
    });

    it("allows a SUPER_ADMIN the privileged teacher-moderation capability", async () => {
      mocks.findUnique.mockResolvedValue(
        adminUser({
          permission:
            "SUPER_ADMIN",
        }),
      );

      await expect(
        requireAdminAccess(
          "super-admin-user",
          "MODERATE_TEACHER",
        ),
      ).resolves.toEqual({
        userId:
          "super-admin-user",
        permission:
          "SUPER_ADMIN",
      });
    });

    it("does not turn a database failure into administrative access", async () => {
      const databaseError =
        new Error(
          "database unavailable",
        );

      mocks.findUnique.mockRejectedValue(
        databaseError,
      );

      await expect(
        requireAdminAccess(
          "admin-user",
        ),
      ).rejects.toBe(
        databaseError,
      );
    });
  },
);

describe(
  "current admin capabilities",
  () => {
    beforeEach(() => {
      mocks.findUnique.mockReset();
    });

    it("returns review-only capabilities for a REVIEWER", async () => {
      mocks.findUnique.mockResolvedValue(
        adminUser({
          permission:
            "REVIEWER",
        }),
      );

      await expect(
        getCurrentAdminCapabilities(
          "reviewer-user",
        ),
      ).resolves.toEqual({
        userId:
          "reviewer-user",
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

    it("returns moderation capabilities only for a SUPER_ADMIN", async () => {
      mocks.findUnique.mockResolvedValue(
        adminUser({
          permission:
            "SUPER_ADMIN",
        }),
      );

      await expect(
        getCurrentAdminCapabilities(
          "super-admin-user",
        ),
      ).resolves.toEqual({
        userId:
          "super-admin-user",
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
  },
);

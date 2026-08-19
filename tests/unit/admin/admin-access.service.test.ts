import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    requireAdminAccess:
      vi.fn(),

    runTransaction:
      vi.fn(),

    reconcileMuxPlayback:
      vi.fn(),

    queueMuxPlaybackIntent:
      vi.fn(),

    reconcilePublicTeacherDiscoveryEligibility:
      vi.fn(),
  }));

vi.mock(
  "@/lib/auth/admin-access",
  () => ({
    requireAdminAccess:
      mocks.requireAdminAccess,
  }),
);

vi.mock(
  "@/lib/services/admin-transaction",
  () => ({
    runSerializableAdminTransaction:
      mocks.runTransaction,
  }),
);

vi.mock(
  "@/lib/services/mux-playback-reconciliation.service",
  () => ({
    queueMuxPlaybackIntent:
      mocks.queueMuxPlaybackIntent,

    reconcileMuxPlayback:
      mocks.reconcileMuxPlayback,
  }),
);

vi.mock(
  "@/lib/services/public-teacher-discovery-eligibility.service",
  () => ({
    reconcilePublicTeacherDiscoveryEligibility:
      mocks.reconcilePublicTeacherDiscoveryEligibility,
  }),
);

import {
  AdminReviewConflictError,
} from "@/lib/errors/admin-errors";

import {
  setAccountStatus,
  setAdministrativeAccess,
} from "@/lib/services/admin-access.service";

describe(
  "administrative operator service boundaries",
  () => {
    beforeEach(() => {
      mocks.requireAdminAccess.mockReset();
      mocks.runTransaction.mockReset();
      mocks.reconcileMuxPlayback.mockReset();
      mocks.queueMuxPlaybackIntent.mockReset();
      mocks
        .reconcilePublicTeacherDiscoveryEligibility
        .mockReset();

      mocks.requireAdminAccess.mockResolvedValue({
        userId:
          "actor",

        permission:
          "SUPER_ADMIN",
      });

      mocks
        .reconcilePublicTeacherDiscoveryEligibility
        .mockResolvedValue(
          false,
        );
    });

    it(
      "requires MANAGE_ADMIN_ACCESS for permission changes and audits the reason",
      async () => {
        const tx = {
          user: {
            findUnique:
              vi.fn().mockResolvedValue({
                accountStatus:
                  "ACTIVE",

                adminAccess:
                  null,
              }),
          },

          adminAccess: {
            upsert:
              vi.fn().mockResolvedValue({
                userId:
                  "target",

                permission:
                  "REVIEWER",
              }),
          },

          adminAuditEvent: {
            create:
              vi.fn().mockResolvedValue(
                {},
              ),
          },
        };

        mocks.runTransaction.mockImplementation(
          async (
            work: (
              transaction:
                typeof tx,
            ) => Promise<unknown>,
          ) =>
            work(
              tx,
            ),
        );

        await setAdministrativeAccess(
          "actor",
          "target",
          "REVIEWER",
          "review operations coverage",
        );

        expect(
          mocks.requireAdminAccess,
        ).toHaveBeenCalledWith(
          "actor",
          "MANAGE_ADMIN_ACCESS",
        );

        expect(
          tx.adminAuditEvent.create,
        ).toHaveBeenCalledWith({
          data: {
            actorUserId:
              "actor",

            targetUserId:
              "target",

            action:
              "ADMIN_ACCESS_GRANTED",

            reason:
              "review operations coverage",

            metadata: {
              previousPermission:
                null,

              newPermission:
                "REVIEWER",
            },
          },
        });

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "refuses to revoke the last active SUPER_ADMIN",
      async () => {
        const tx = {
          user: {
            findUnique:
              vi.fn().mockResolvedValue({
                accountStatus:
                  "ACTIVE",

                adminAccess: {
                  permission:
                    "SUPER_ADMIN",

                  revokedAt:
                    null,
                },
              }),
          },

          adminAccess: {
            findUnique:
              vi.fn().mockResolvedValue({
                permission:
                  "SUPER_ADMIN",

                revokedAt:
                  null,

                user: {
                  accountStatus:
                    "ACTIVE",
                },
              }),

            count:
              vi.fn().mockResolvedValue(
                1,
              ),

            update:
              vi.fn(),
          },

          adminAuditEvent: {
            create:
              vi.fn(),
          },
        };

        mocks.runTransaction.mockImplementation(
          async (
            work: (
              transaction:
                typeof tx,
            ) => Promise<unknown>,
          ) =>
            work(
              tx,
            ),
        );

        await expect(
          setAdministrativeAccess(
            "actor",
            "target",
            null,
            "remove obsolete access",
          ),
        ).rejects.toBeInstanceOf(
          AdminReviewConflictError,
        );

        expect(
          tx.adminAccess.update,
        ).not.toHaveBeenCalled();

        expect(
          tx.adminAuditEvent.create,
        ).not.toHaveBeenCalled();

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "requires MODERATE_ACCOUNT for account state changes",
      async () => {
        const tx = {
          user: {
            findUnique:
              vi.fn().mockResolvedValue({
                accountStatus:
                  "ACTIVE",

                teacherProfile:
                  null,
              }),

            updateMany:
              vi.fn().mockResolvedValue({
                count:
                  1,
              }),
          },

          adminAccess: {
            findUnique:
              vi.fn().mockResolvedValue(
                null,
              ),
          },

          adminAuditEvent: {
            create:
              vi.fn().mockResolvedValue(
                {},
              ),
          },
        };

        mocks.runTransaction.mockImplementation(
          async (
            work: (
              transaction:
                typeof tx,
            ) => Promise<unknown>,
          ) =>
            work(
              tx,
            ),
        );

        await setAccountStatus(
          "actor",
          "target",
          "SUSPENDED",
          "manual moderation",
        );

        expect(
          mocks.requireAdminAccess,
        ).toHaveBeenCalledWith(
          "actor",
          "MODERATE_ACCOUNT",
        );

        expect(
          tx.adminAuditEvent.create,
        ).toHaveBeenCalledWith({
          data: {
            actorUserId:
              "actor",

            targetUserId:
              "target",

            action:
              "ACCOUNT_STATUS_CHANGED",

            reason:
              "manual moderation",

            metadata: {
              previousAccountStatus:
                "ACTIVE",

              newAccountStatus:
                "SUSPENDED",
            },
          },
        });

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "reconciles teacher discovery membership inside the account-status transaction",
      async () => {
        const tx = {
          user: {
            findUnique:
              vi.fn().mockResolvedValue({
                accountStatus:
                  "ACTIVE",

                teacherProfile: {
                  id:
                    "teacher-profile-1",

                  applicationStatus:
                    "APPROVED",

                  profileCompletedAt:
                    new Date(
                      "2026-08-01T00:00:00.000Z",
                    ),

                  introVideo:
                    null,
                },
              }),

            updateMany:
              vi.fn().mockResolvedValue({
                count:
                  1,
              }),
          },

          adminAccess: {
            findUnique:
              vi.fn().mockResolvedValue(
                null,
              ),
          },

          adminAuditEvent: {
            create:
              vi.fn().mockResolvedValue(
                {},
              ),
          },
        };

        mocks.runTransaction.mockImplementation(
          async (
            work: (
              transaction:
                typeof tx,
            ) => Promise<unknown>,
          ) =>
            work(
              tx,
            ),
        );

        await setAccountStatus(
          "actor",
          "teacher-user",
          "SUSPENDED",
          "manual moderation",
        );

        expect(
          tx.user.updateMany,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).toHaveBeenCalledTimes(
          1,
        );

        expect(
          mocks
            .reconcilePublicTeacherDiscoveryEligibility,
        ).toHaveBeenCalledWith(
          "teacher-profile-1",
          tx,
        );

        /*
         * The service receives the exact transaction object.
         * Therefore the source write and projection write cannot
         * commit independently.
         */
        expect(
          tx.adminAuditEvent.create,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );
  },
);

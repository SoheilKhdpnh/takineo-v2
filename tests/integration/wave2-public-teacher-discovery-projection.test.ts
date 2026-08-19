import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  createTestPrismaClient,
} from "@/tests/support/test-prisma-client";

const IDS = {
  transitionUser:
    "it_projection_transition_user",
  transitionProfile:
    "it_projection_transition_profile",
  transitionVideo:
    "it_projection_transition_video",

  rollbackUser:
    "it_projection_rollback_user",
  rollbackProfile:
    "it_projection_rollback_profile",
  rollbackVideo:
    "it_projection_rollback_video",

  cascadeUser:
    "it_projection_cascade_user",
  cascadeProfile:
    "it_projection_cascade_profile",
  cascadeVideo:
    "it_projection_cascade_video",

  auditPublicUser:
    "it_projection_audit_public_user",
  auditPublicProfile:
    "it_projection_audit_public_profile",
  auditPublicVideo:
    "it_projection_audit_public_video",

  auditMissingUser:
    "it_projection_audit_missing_user",
  auditMissingProfile:
    "it_projection_audit_missing_profile",
  auditMissingVideo:
    "it_projection_audit_missing_video",

  auditStaleUser:
    "it_projection_audit_stale_user",
  auditStaleProfile:
    "it_projection_audit_stale_profile",
  auditStaleVideo:
    "it_projection_audit_stale_video",
} as const;

const ALL_USER_IDS = [
  IDS.transitionUser,
  IDS.rollbackUser,
  IDS.cascadeUser,
  IDS.auditPublicUser,
  IDS.auditMissingUser,
  IDS.auditStaleUser,
] as const;

const prisma =
  createTestPrismaClient();

let reconcilePublicTeacherDiscoveryEligibility:
  typeof import(
    "@/lib/services/public-teacher-discovery-eligibility.service"
  ).reconcilePublicTeacherDiscoveryEligibility;

let auditPublicTeacherDiscoveryEligibility:
  typeof import(
    "@/lib/services/public-teacher-discovery-eligibility.service"
  ).auditPublicTeacherDiscoveryEligibility;

let repairPublicTeacherDiscoveryEligibility:
  typeof import(
    "@/lib/services/public-teacher-discovery-eligibility.service"
  ).repairPublicTeacherDiscoveryEligibility;

type SeedInput = {
  userId:
    string;

  teacherProfileId:
    string;

  introVideoId:
    string;

  accountStatus?:
    "ACTIVE" |
    "SUSPENDED" |
    "DISABLED";

  applicationStatus?:
    "DRAFT" |
    "PENDING_REVIEW" |
    "APPROVED" |
    "REJECTED" |
    "SUSPENDED";

  profileCompleted?:
    boolean;

  videoStatus?:
    "UPLOAD_PENDING" |
    "PROCESSING" |
    "READY_FOR_REVIEW" |
    "APPROVED" |
    "REJECTED" |
    "FAILED" |
    null;
};

async function cleanupFixtures():
  Promise<void> {
  /*
   * User -> TeacherProfile uses cascade, and both the intro video
   * and discovery projection cascade from TeacherProfile.
   *
   * Deleting the isolated fixture users therefore removes the
   * complete fixture graph without touching unrelated rows.
   */
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [
          ...ALL_USER_IDS,
        ],
      },
    },
  });
}

async function seedTeacher(
  input:
    SeedInput,
): Promise<void> {
  await prisma.user.create({
    data: {
      id:
        input.userId,

      name:
        `Projection fixture ${input.userId}`,

      email:
        `${input.userId}@example.test`,

      emailVerified:
        true,

      role:
        "TEACHER",

      accountStatus:
        input.accountStatus ??
        "ACTIVE",

      createdAt:
        new Date(
          "2026-08-18T00:00:00.000Z",
        ),

      updatedAt:
        new Date(
          "2026-08-18T00:00:00.000Z",
        ),
    },
  });

  await prisma.teacherProfile.create({
    data: {
      id:
        input.teacherProfileId,

      userId:
        input.userId,

      headline:
        "Projection invariant fixture",

      bio:
        "Real PostgreSQL public teacher discovery projection invariant fixture.",

      nativeLanguage:
        "fa",

      teachingLanguage:
        "en",

      timezone:
        "Asia_Tehran",

      profileCompletedAt:
        input.profileCompleted === false
          ? null
          : new Date(
              "2026-08-18T08:00:00.000Z",
            ),

      applicationStatus:
        input.applicationStatus ??
        "APPROVED",
    },
  });

  if (
    input.videoStatus !==
    null
  ) {
    await prisma.teacherIntroVideo.create({
      data: {
        id:
          input.introVideoId,

        teacherProfileId:
          input.teacherProfileId,

        status:
          input.videoStatus ??
          "APPROVED",

        durationSeconds:
          90,
      },
    });
  }
}

async function reconcile(
  teacherProfileId:
    string,
): Promise<boolean> {
  return prisma.$transaction(
    async (
      tx,
    ) =>
      reconcilePublicTeacherDiscoveryEligibility(
        teacherProfileId,
        tx,
      ),
  );
}

async function membershipExists(
  teacherProfileId:
    string,
): Promise<boolean> {
  const count =
    await prisma
      .publicTeacherDiscoveryEligibility
      .count({
        where: {
          teacherProfileId,
        },
      });

  return count === 1;
}

describe.sequential(
  "Wave 2 public teacher discovery eligibility projection",
  () => {
    beforeAll(
      async () => {
        /*
         * Bind the production service to the same isolated Prisma
         * client used by this integration test.
         */
        vi.resetModules();

        vi.doMock(
          "@/lib/db/prisma",
          () => ({
            prisma,
          }),
        );

        const service =
          await import(
            "@/lib/services/public-teacher-discovery-eligibility.service"
          );

        reconcilePublicTeacherDiscoveryEligibility =
          service.reconcilePublicTeacherDiscoveryEligibility;

        auditPublicTeacherDiscoveryEligibility =
          service.auditPublicTeacherDiscoveryEligibility;

        repairPublicTeacherDiscoveryEligibility =
          service.repairPublicTeacherDiscoveryEligibility;
      },
    );

    beforeEach(
      async () => {
        await cleanupFixtures();
      },
    );

    afterAll(
      async () => {
        try {
          await cleanupFixtures();
        }
        finally {
          vi.doUnmock(
            "@/lib/db/prisma",
          );

          vi.resetModules();

          await prisma.$disconnect();
        }
      },
    );

    test(
      "real PostgreSQL membership follows every canonical public eligibility input",
      async () => {
        await seedTeacher({
          userId:
            IDS.transitionUser,

          teacherProfileId:
            IDS.transitionProfile,

          introVideoId:
            IDS.transitionVideo,
        });

        /*
         * ACTIVE + APPROVED + completed + APPROVED video.
         */
        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          true,
        );

        await expect(
          membershipExists(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          true,
        );

        /*
         * Account state revocation.
         */
        await prisma.user.update({
          where: {
            id:
              IDS.transitionUser,
          },

          data: {
            accountStatus:
              "SUSPENDED",
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          false,
        );

        await expect(
          membershipExists(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          false,
        );

        /*
         * Account restored.
         */
        await prisma.user.update({
          where: {
            id:
              IDS.transitionUser,
          },

          data: {
            accountStatus:
              "ACTIVE",
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          true,
        );

        /*
         * Application suspension.
         */
        await prisma.teacherProfile.update({
          where: {
            id:
              IDS.transitionProfile,
          },

          data: {
            applicationStatus:
              "SUSPENDED",
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          false,
        );

        /*
         * Application reinstated.
         */
        await prisma.teacherProfile.update({
          where: {
            id:
              IDS.transitionProfile,
          },

          data: {
            applicationStatus:
              "APPROVED",
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          true,
        );

        /*
         * Completed profile becomes incomplete.
         */
        await prisma.teacherProfile.update({
          where: {
            id:
              IDS.transitionProfile,
          },

          data: {
            profileCompletedAt:
              null,
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          false,
        );

        /*
         * Profile becomes complete again.
         */
        await prisma.teacherProfile.update({
          where: {
            id:
              IDS.transitionProfile,
          },

          data: {
            profileCompletedAt:
              new Date(
                "2026-08-18T09:00:00.000Z",
              ),
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          true,
        );

        /*
         * Video approval revoked.
         */
        await prisma.teacherIntroVideo.update({
          where: {
            id:
              IDS.transitionVideo,
          },

          data: {
            status:
              "REJECTED",
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          false,
        );

        /*
         * Video approval restored.
         */
        await prisma.teacherIntroVideo.update({
          where: {
            id:
              IDS.transitionVideo,
          },

          data: {
            status:
              "APPROVED",
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          true,
        );

        /*
         * Missing video is non-public.
         */
        await prisma.teacherIntroVideo.delete({
          where: {
            id:
              IDS.transitionVideo,
          },
        });

        await expect(
          reconcile(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          false,
        );

        await expect(
          membershipExists(
            IDS.transitionProfile,
          ),
        ).resolves.toBe(
          false,
        );
      },
    );

    test(
      "source transition and membership insertion roll back atomically",
      async () => {
        await seedTeacher({
          userId:
            IDS.rollbackUser,

          teacherProfileId:
            IDS.rollbackProfile,

          introVideoId:
            IDS.rollbackVideo,

          applicationStatus:
            "SUSPENDED",
        });

        expect(
          await membershipExists(
            IDS.rollbackProfile,
          ),
        ).toBe(
          false,
        );

        await expect(
          prisma.$transaction(
            async (
              tx,
            ) => {
              await tx.teacherProfile.update({
                where: {
                  id:
                    IDS.rollbackProfile,
                },

                data: {
                  applicationStatus:
                    "APPROVED",
                },
              });

              const eligible =
                await reconcilePublicTeacherDiscoveryEligibility(
                  IDS.rollbackProfile,
                  tx,
                );

              expect(
                eligible,
              ).toBe(
                true,
              );

              expect(
                await tx
                  .publicTeacherDiscoveryEligibility
                  .count({
                    where: {
                      teacherProfileId:
                        IDS.rollbackProfile,
                    },
                  }),
              ).toBe(
                1,
              );

              throw new Error(
                "intentional projection rollback",
              );
            },
          ),
        ).rejects.toThrow(
          "intentional projection rollback",
        );

        const profile =
          await prisma.teacherProfile
            .findUniqueOrThrow({
              where: {
                id:
                  IDS.rollbackProfile,
              },

              select: {
                applicationStatus:
                  true,
              },
            });

        expect(
          profile.applicationStatus,
        ).toBe(
          "SUSPENDED",
        );

        expect(
          await membershipExists(
            IDS.rollbackProfile,
          ),
        ).toBe(
          false,
        );
      },
    );

    test(
      "teacher profile deletion cascades projection membership",
      async () => {
        await seedTeacher({
          userId:
            IDS.cascadeUser,

          teacherProfileId:
            IDS.cascadeProfile,

          introVideoId:
            IDS.cascadeVideo,
        });

        await reconcile(
          IDS.cascadeProfile,
        );

        expect(
          await membershipExists(
            IDS.cascadeProfile,
          ),
        ).toBe(
          true,
        );

        await prisma.teacherProfile.delete({
          where: {
            id:
              IDS.cascadeProfile,
          },
        });

        expect(
          await membershipExists(
            IDS.cascadeProfile,
          ),
        ).toBe(
          false,
        );

        /*
         * User is intentionally still present, proving that the
         * membership disappearance came through the profile FK
         * cascade rather than fixture teardown.
         */
        expect(
          await prisma.user.count({
            where: {
              id:
                IDS.cascadeUser,
            },
          }),
        ).toBe(
          1,
        );
      },
    );

    test(
      "audit detects missing and stale membership and repair restores canonical equality",
      async () => {
        await seedTeacher({
          userId:
            IDS.auditPublicUser,

          teacherProfileId:
            IDS.auditPublicProfile,

          introVideoId:
            IDS.auditPublicVideo,
        });

        await seedTeacher({
          userId:
            IDS.auditMissingUser,

          teacherProfileId:
            IDS.auditMissingProfile,

          introVideoId:
            IDS.auditMissingVideo,
        });

        await seedTeacher({
          userId:
            IDS.auditStaleUser,

          teacherProfileId:
            IDS.auditStaleProfile,

          introVideoId:
            IDS.auditStaleVideo,

          applicationStatus:
            "SUSPENDED",
        });

        /*
         * Correct membership.
         */
        await prisma
          .publicTeacherDiscoveryEligibility
          .create({
            data: {
              teacherProfileId:
                IDS.auditPublicProfile,
            },
          });

        /*
         * IDS.auditMissingProfile is intentionally omitted.
         */

        /*
         * Stale membership for a non-public teacher.
         */
        await prisma
          .publicTeacherDiscoveryEligibility
          .create({
            data: {
              teacherProfileId:
                IDS.auditStaleProfile,
            },
          });

        const before =
          await auditPublicTeacherDiscoveryEligibility();

        expect(
          before.missingMembershipIds,
        ).toContain(
          IDS.auditMissingProfile,
        );

        expect(
          before.staleMembershipIds,
        ).toContain(
          IDS.auditStaleProfile,
        );

        expect(
          before.inSync,
        ).toBe(
          false,
        );

        const repair =
          await repairPublicTeacherDiscoveryEligibility();

        expect(
          repair.missingMembershipIds,
        ).toContain(
          IDS.auditMissingProfile,
        );

        expect(
          repair.staleMembershipIds,
        ).toContain(
          IDS.auditStaleProfile,
        );

        const after =
          await auditPublicTeacherDiscoveryEligibility();

        expect(
          after.missingMembershipIds,
        ).not.toContain(
          IDS.auditMissingProfile,
        );

        expect(
          after.staleMembershipIds,
        ).not.toContain(
          IDS.auditStaleProfile,
        );

        expect(
          await membershipExists(
            IDS.auditPublicProfile,
          ),
        ).toBe(
          true,
        );

        expect(
          await membershipExists(
            IDS.auditMissingProfile,
          ),
        ).toBe(
          true,
        );

        expect(
          await membershipExists(
            IDS.auditStaleProfile,
          ),
        ).toBe(
          false,
        );
      },
    );
  },
);

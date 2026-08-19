import "server-only";

import {
  prisma,
} from "@/lib/db/prisma";
import {
  isPublicTeacher,
} from "@/lib/domain/teacher-application";
import {
  Prisma,
} from "@/lib/generated/prisma/client";

const eligibilitySourceSelect = {
  id:
    true,

  applicationStatus:
    true,

  profileCompletedAt:
    true,

  user: {
    select: {
      accountStatus:
        true,
    },
  },

  introVideo: {
    select: {
      status:
        true,
    },
  },
} satisfies
  Prisma.TeacherProfileSelect;

type EligibilitySource =
  Prisma.TeacherProfileGetPayload<{
    select:
      typeof eligibilitySourceSelect;
  }>;

function sourceIsPublic(
  teacher:
    EligibilitySource,
): boolean {
  return isPublicTeacher(
    teacher.user.accountStatus,
    teacher.applicationStatus,
    teacher.profileCompletedAt,
    teacher.introVideo?.status ?? null,
  );
}

/*
 * Transaction-aware membership reconciliation.
 *
 * The caller owns the surrounding source mutation transaction.
 * This function must therefore never open or commit an independent
 * transaction of its own.
 */
export async function reconcilePublicTeacherDiscoveryEligibility(
  teacherProfileId:
    string,
  tx:
    Prisma.TransactionClient,
): Promise<boolean> {
  const teacher =
    await tx.teacherProfile.findUnique({
      where: {
        id:
          teacherProfileId,
      },

      select:
        eligibilitySourceSelect,
    });

  const eligible =
    teacher !== null &&
    sourceIsPublic(
      teacher,
    );

  if (
    eligible
  ) {
    await tx
      .publicTeacherDiscoveryEligibility
      .upsert({
        where: {
          teacherProfileId,
        },

        create: {
          teacherProfileId,
        },

        update: {},
      });

    return true;
  }

  await tx
    .publicTeacherDiscoveryEligibility
    .deleteMany({
      where: {
        teacherProfileId,
      },
    });

  return false;
}

export type PublicTeacherDiscoveryEligibilityAudit = {
  checkedTeacherProfiles:
    number;

  projectionRows:
    number;

  missingMembershipIds:
    string[];

  staleMembershipIds:
    string[];

  inSync:
    boolean;
};

/*
 * Operational drift detector.
 *
 * Product correctness must not depend on this being run
 * periodically; normal writes reconcile transactionally.
 */
export async function auditPublicTeacherDiscoveryEligibility():
  Promise<PublicTeacherDiscoveryEligibilityAudit> {
  const [
    teachers,
    memberships,
  ] =
    await Promise.all([
      prisma.teacherProfile.findMany({
        select:
          eligibilitySourceSelect,
      }),

      prisma
        .publicTeacherDiscoveryEligibility
        .findMany({
          select: {
            teacherProfileId:
              true,
          },
        }),
    ]);

  const expected =
    new Set(
      teachers
        .filter(
          sourceIsPublic,
        )
        .map(
          (
            teacher,
          ) =>
            teacher.id,
        ),
    );

  const actual =
    new Set(
      memberships.map(
        (
          membership,
        ) =>
          membership.teacherProfileId,
      ),
    );

  const missingMembershipIds =
    [...expected]
      .filter(
        (
          teacherProfileId,
        ) =>
          !actual.has(
            teacherProfileId,
          ),
      )
      .sort();

  const staleMembershipIds =
    [...actual]
      .filter(
        (
          teacherProfileId,
        ) =>
          !expected.has(
            teacherProfileId,
          ),
      )
      .sort();

  return {
    checkedTeacherProfiles:
      teachers.length,

    projectionRows:
      memberships.length,

    missingMembershipIds,

    staleMembershipIds,

    inSync:
      missingMembershipIds.length ===
        0 &&
      staleMembershipIds.length ===
        0,
  };
}

export type PublicTeacherDiscoveryEligibilityRepair =
  PublicTeacherDiscoveryEligibilityAudit & {
    insertedMemberships:
      number;

    deletedMemberships:
      number;
  };

/*
 * Explicit operational repair primitive.
 *
 * This is not part of normal request correctness. It exists for
 * controlled drift recovery and still derives expected membership
 * from the canonical TypeScript policy rather than a second runtime
 * eligibility definition.
 */
export async function repairPublicTeacherDiscoveryEligibility():
  Promise<PublicTeacherDiscoveryEligibilityRepair> {
  return prisma.$transaction(
    async (
      tx,
    ) => {
      const [
        teachers,
        memberships,
      ] =
        await Promise.all([
          tx.teacherProfile.findMany({
            select:
              eligibilitySourceSelect,
          }),

          tx
            .publicTeacherDiscoveryEligibility
            .findMany({
              select: {
                teacherProfileId:
                  true,
              },
            }),
        ]);

      const expected =
        new Set(
          teachers
            .filter(
              sourceIsPublic,
            )
            .map(
              (
                teacher,
              ) =>
                teacher.id,
            ),
        );

      const actual =
        new Set(
          memberships.map(
            (
              membership,
            ) =>
              membership.teacherProfileId,
          ),
        );

      const missingMembershipIds =
        [...expected]
          .filter(
            (
              teacherProfileId,
            ) =>
              !actual.has(
                teacherProfileId,
              ),
          )
          .sort();

      const staleMembershipIds =
        [...actual]
          .filter(
            (
              teacherProfileId,
            ) =>
              !expected.has(
                teacherProfileId,
              ),
          )
          .sort();

      let insertedMemberships =
        0;

      let deletedMemberships =
        0;

      if (
        missingMembershipIds.length >
        0
      ) {
        const result =
          await tx
            .publicTeacherDiscoveryEligibility
            .createMany({
              data:
                missingMembershipIds.map(
                  (
                    teacherProfileId,
                  ) => ({
                    teacherProfileId,
                  }),
                ),

              skipDuplicates:
                true,
            });

        insertedMemberships =
          result.count;
      }

      if (
        staleMembershipIds.length >
        0
      ) {
        const result =
          await tx
            .publicTeacherDiscoveryEligibility
            .deleteMany({
              where: {
                teacherProfileId: {
                  in:
                    staleMembershipIds,
                },
              },
            });

        deletedMemberships =
          result.count;
      }

      return {
        checkedTeacherProfiles:
          teachers.length,

        projectionRows:
          memberships.length,

        missingMembershipIds,

        staleMembershipIds,

        inSync:
          missingMembershipIds.length ===
            0 &&
          staleMembershipIds.length ===
            0,

        insertedMemberships,

        deletedMemberships,
      };
    },
  );
}

import "server-only";

import { requireAdminAccess } from "@/lib/auth/admin-access";
import { isPublicTeacher } from "@/lib/domain/teacher-application";
import {
  AdminReviewConflictError,
  AdminTargetNotFoundError,
} from "@/lib/errors/admin-errors";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  queueMuxPlaybackIntent,
  reconcileMuxPlayback,
} from "@/lib/services/mux-playback-reconciliation.service";
import {
  reconcilePublicTeacherDiscoveryEligibility,
} from "@/lib/services/public-teacher-discovery-eligibility.service";
import {
  runSerializableAdminTransaction,
} from "@/lib/services/admin-transaction";

async function assertNotLastActiveSuperAdmin(
  tx: Prisma.TransactionClient,
  targetUserId: string,
) {
  const target =
    await tx.adminAccess.findUnique({
      where: {
        userId: targetUserId,
      },
      select: {
        permission: true,
        revokedAt: true,
        user: {
          select: {
            accountStatus: true,
          },
        },
      },
    });

  if (
    target?.permission !== "SUPER_ADMIN" ||
    target.revokedAt ||
    target.user.accountStatus !== "ACTIVE"
  ) {
    return;
  }

  const activeSuperAdmins =
    await tx.adminAccess.count({
      where: {
        permission: "SUPER_ADMIN",
        revokedAt: null,
        user: {
          accountStatus: "ACTIVE",
        },
      },
    });

  if (activeSuperAdmins <= 1) {
    throw new AdminReviewConflictError();
  }
}

export async function setAdministrativeAccess(
  actorUserId: string,
  targetUserId: string,
  permission: "REVIEWER" | "SUPER_ADMIN" | null,
  reason: string,
) {
  await requireAdminAccess(
    actorUserId,
    "MANAGE_ADMIN_ACCESS",
  );

  return runSerializableAdminTransaction(
    async (tx) => {
      const target =
        await tx.user.findUnique({
          where: {
            id: targetUserId,
          },
          select: {
            accountStatus: true,
            adminAccess: true,
          },
        });

      if (!target) {
        throw new AdminTargetNotFoundError();
      }

      if (
        target.accountStatus !== "ACTIVE" &&
        permission
      ) {
        throw new AdminReviewConflictError();
      }

      const previousPermission =
        target.adminAccess?.revokedAt
          ? null
          : target.adminAccess?.permission ?? null;

      if (previousPermission === permission) {
        throw new AdminReviewConflictError();
      }

      if (
        previousPermission === "SUPER_ADMIN" &&
        permission !== "SUPER_ADMIN"
      ) {
        await assertNotLastActiveSuperAdmin(
          tx,
          targetUserId,
        );
      }

      const access =
        permission
          ? await tx.adminAccess.upsert({
              where: {
                userId: targetUserId,
              },
              create: {
                userId: targetUserId,
                permission,
              },
              update: {
                permission,
                revokedAt: null,
              },
            })
          : target.adminAccess
            ? await tx.adminAccess.update({
                where: {
                  userId: targetUserId,
                },
                data: {
                  revokedAt: new Date(),
                },
              })
            : null;

      await tx.adminAuditEvent.create({
        data: {
          actorUserId,
          targetUserId,
          action:
            !permission
              ? "ADMIN_ACCESS_REVOKED"
              : previousPermission
                ? "ADMIN_PERMISSION_CHANGED"
                : "ADMIN_ACCESS_GRANTED",
          reason,
          metadata: {
            previousPermission,
            newPermission: permission,
          },
        },
      });

      return access;
    },
  );
}

export async function setAccountStatus(
  actorUserId: string,
  targetUserId: string,
  accountStatus:
    | "ACTIVE"
    | "SUSPENDED"
    | "DISABLED",
  reason: string,
) {
  await requireAdminAccess(
    actorUserId,
    "MODERATE_ACCOUNT",
  );

  const reconciliationId =
    await runSerializableAdminTransaction(
      async (tx) => {
        const target =
          await tx.user.findUnique({
            where: {
              id: targetUserId,
            },
            select: {
              accountStatus: true,

              teacherProfile: {
                select: {
                  id: true,
                  applicationStatus: true,
                  profileCompletedAt: true,

                  introVideo: {
                    select: {
                      id: true,
                      revision: true,
                      status: true,
                      assetId: true,
                      publicPlaybackId: true,
                    },
                  },
                },
              },
            },
          });

        if (!target) {
          throw new AdminTargetNotFoundError();
        }

        if (
          target.accountStatus ===
          accountStatus
        ) {
          throw new AdminReviewConflictError();
        }

        if (accountStatus !== "ACTIVE") {
          await assertNotLastActiveSuperAdmin(
            tx,
            targetUserId,
          );
        }

        const changed =
          await tx.user.updateMany({
            where: {
              id: targetUserId,
              accountStatus:
                target.accountStatus,
            },
            data: {
              accountStatus,
            },
          });

        if (changed.count !== 1) {
          throw new AdminReviewConflictError();
        }

        const teacherProfile =
          target.teacherProfile;

        /*
         * Account status is one of the four canonical
         * public-teacher eligibility inputs.
         *
         * Reconcile membership before this SERIALIZABLE
         * transaction commits.
         */
        if (teacherProfile) {
          await reconcilePublicTeacherDiscoveryEligibility(
            teacherProfile.id,
            tx,
          );
        }

        let playbackReconciliationId:
          string | null = null;

        const video =
          teacherProfile?.introVideo;

        if (
          teacherProfile &&
          video?.assetId
        ) {
          /*
           * Reuse the canonical eligibility policy rather
           * than maintaining a second inline definition.
           */
          const eligible =
            isPublicTeacher(
              accountStatus,
              teacherProfile.applicationStatus,
              teacherProfile.profileCompletedAt,
              video.status,
            );

          const reconciliation =
            await queueMuxPlaybackIntent(
              tx,
              {
                introVideoId:
                  video.id,

                videoRevision:
                  video.revision,

                assetId:
                  video.assetId,

                playbackId:
                  video.publicPlaybackId,

                desiredState:
                  eligible
                    ? "ENABLED"
                    : "REVOKED",
              },
            );

          playbackReconciliationId =
            reconciliation.id;
        }

        await tx.adminAuditEvent.create({
          data: {
            actorUserId,
            targetUserId,
            action:
              "ACCOUNT_STATUS_CHANGED",
            reason,
            metadata: {
              previousAccountStatus:
                target.accountStatus,

              newAccountStatus:
                accountStatus,
            },
          },
        });

        return playbackReconciliationId;
      },
    );

  if (reconciliationId) {
    await reconcileMuxPlayback(
      reconciliationId,
    );
  }

  return {
    id: targetUserId,
    accountStatus,
  };
}

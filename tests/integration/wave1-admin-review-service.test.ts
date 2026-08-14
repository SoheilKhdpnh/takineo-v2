import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  createAdminServiceFixtures,
  type AdminReviewableTeacherFixture,
} from "@/tests/support/admin-service-fixtures";
import { createTestPrismaClient } from "@/tests/support/test-prisma-client";

const fixtures = createAdminServiceFixtures("review_acceptance");

let applicationPrisma: ReturnType<typeof createTestPrismaClient> | null = null;
let approveTeacherApplication: typeof import(
  "@/lib/services/admin-review.service"
).approveTeacherApplication;
let rejectTeacherApplication: typeof import(
  "@/lib/services/admin-review.service"
).rejectTeacherApplication;
let setTeacherSuspension: typeof import(
  "@/lib/services/admin-review.service"
).setTeacherSuspension;
let setAccountStatus: typeof import(
  "@/lib/services/admin-access.service"
).setAccountStatus;
let AdminReviewConflictError: typeof import(
  "@/lib/errors/admin-errors"
).AdminReviewConflictError;

const reconcileMuxPlayback = vi.fn(async () => undefined);
const cleanupMuxReviewPlayback = vi.fn(async () => undefined);

type Seeded = {
  reviewer: Awaited<ReturnType<typeof fixtures.createAdministrator>>;
  superAdmin: Awaited<ReturnType<typeof fixtures.createAdministrator>>;
  approve: AdminReviewableTeacherFixture;
  rejectProfile: AdminReviewableTeacherFixture;
  rejectVideo: AdminReviewableTeacherFixture;
  stale: AdminReviewableTeacherFixture;
  duplicate: AdminReviewableTeacherFixture;
  inactive: AdminReviewableTeacherFixture;
  accountRace: AdminReviewableTeacherFixture;
  atomic: AdminReviewableTeacherFixture;
  moderationConflict: AdminReviewableTeacherFixture;
};

let seeded: Seeded;

async function seedFixtures(): Promise<Seeded> {
  const reviewer = await fixtures.createAdministrator({
    key: "reviewer",
    permission: "REVIEWER",
    productRole: "STUDENT",
  });
  const superAdmin = await fixtures.createAdministrator({
    key: "super_admin",
    permission: "SUPER_ADMIN",
    productRole: "STUDENT",
  });

  const keys = [
    "approve",
    "reject_profile",
    "reject_video",
    "stale",
    "duplicate",
    "inactive",
    "account_race",
    "atomic",
    "moderation_conflict",
  ] as const;

  const applications = await Promise.all(
    keys.map((key) => fixtures.createReviewableTeacherApplicant({ key })),
  );

  return {
    reviewer,
    superAdmin,
    approve: applications[0],
    rejectProfile: applications[1],
    rejectVideo: applications[2],
    stale: applications[3],
    duplicate: applications[4],
    inactive: applications[5],
    accountRace: applications[6],
    atomic: applications[7],
    moderationConflict: applications[8],
  };
}

function prisma() {
  if (!applicationPrisma) {
    throw new Error("Administrative review acceptance Prisma is unavailable.");
  }
  return applicationPrisma;
}

async function loadState(target: AdminReviewableTeacherFixture) {
  const [profile, video, audits, reconciliations] = await Promise.all([
    prisma().teacherProfile.findUniqueOrThrow({
      where: { id: target.teacherProfileId },
      select: {
        applicationStatus: true,
        applicationReviewNote: true,
        reviewCycle: true,
      },
    }),
    prisma().teacherIntroVideo.findUniqueOrThrow({
      where: { id: target.introVideoId },
      select: {
        status: true,
        rejectionReason: true,
        revision: true,
      },
    }),
    prisma().adminAuditEvent.findMany({
      where: { teacherProfileId: target.teacherProfileId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma().muxPlaybackReconciliation.findMany({
      where: { introVideoId: target.introVideoId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { profile, video, audits, reconciliations };
}

async function installAuditFailureTrigger(
  target: AdminReviewableTeacherFixture,
): Promise<() => Promise<void>> {
  const suffix = fixtures.prefix.slice(-12);
  const functionName = `it_fail_audit_${suffix}`;
  const triggerName = `it_fail_audit_trigger_${suffix}`;

  await prisma().$executeRawUnsafe(`
    CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
    BEGIN
      IF NEW."actorUserId" = '${seeded.reviewer.userId}'
         AND NEW."teacherProfileId" = '${target.teacherProfileId}' THEN
        RAISE EXCEPTION 'intentional admin audit acceptance failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await prisma().$executeRawUnsafe(`
    CREATE TRIGGER "${triggerName}"
    BEFORE INSERT ON "admin_audit_event"
    FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
  `);

  return async () => {
    await prisma().$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON "admin_audit_event"`,
    );
    await prisma().$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS "${functionName}"()`,
    );
  };
}

describe("Wave 1 administrative review mutation acceptance", () => {
  beforeAll(async () => {
    await fixtures.connect("takineo-wave1-admin-review-acceptance-test");
    applicationPrisma = createTestPrismaClient();

    vi.resetModules();
    vi.doMock("@/lib/db/prisma", () => ({ prisma: applicationPrisma }));
    vi.doMock(
      "@/lib/services/mux-playback-reconciliation.service",
      async () => {
        const actual = await vi.importActual<
          typeof import("@/lib/services/mux-playback-reconciliation.service")
        >("@/lib/services/mux-playback-reconciliation.service");
        return {
          ...actual,
          reconcileMuxPlayback,
        };
      },
    );
    vi.doMock("@/lib/video/mux-review-playback", () => ({
      cleanupMuxReviewPlayback,
    }));

    const errors = await import("@/lib/errors/admin-errors");
    AdminReviewConflictError = errors.AdminReviewConflictError;

    const review = await import("@/lib/services/admin-review.service");
    approveTeacherApplication = review.approveTeacherApplication;
    rejectTeacherApplication = review.rejectTeacherApplication;
    setTeacherSuspension = review.setTeacherSuspension;
    ({ setAccountStatus } = await import("@/lib/services/admin-access.service"));

    seeded = await seedFixtures();
  });

  afterAll(async () => {
    try {
      await applicationPrisma?.$disconnect();
      applicationPrisma = null;
    } finally {
      try {
        await fixtures.dispose();
      } finally {
        vi.doUnmock("@/lib/db/prisma");
        vi.doUnmock("@/lib/services/mux-playback-reconciliation.service");
        vi.doUnmock("@/lib/video/mux-review-playback");
        vi.resetModules();
      }
    }
  });

  test("approval commits one state transition, one playback intent, and the complete review snapshot audit", async () => {
    const result = await approveTeacherApplication(
      seeded.reviewer.userId,
      seeded.approve.teacherProfileId,
      seeded.approve.guard,
    );

    expect(result.applicationStatus).toBe("APPROVED");

    const state = await loadState(seeded.approve);
    expect(state.profile.applicationStatus).toBe("APPROVED");
    expect(state.video.status).toBe("APPROVED");
    expect(state.reconciliations).toHaveLength(1);
    expect(state.reconciliations[0]?.desiredState).toBe("ENABLED");
    expect(state.audits).toHaveLength(3);
    expect(state.audits.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "PROFILE_APPROVED",
        "VIDEO_APPROVED",
        "APPLICATION_APPROVED",
      ]),
    );

    for (const event of state.audits) {
      expect(event).toMatchObject({
        actorUserId: seeded.reviewer.userId,
        targetUserId: seeded.approve.userId,
        teacherProfileId: seeded.approve.teacherProfileId,
        introVideoId: seeded.approve.introVideoId,
        reviewCycle: seeded.approve.reviewCycle,
        profileRevision: seeded.approve.profileRevision,
        videoRevision: seeded.approve.videoRevision,
        reviewedUploadId: seeded.approve.uploadId,
        reviewedAssetId: seeded.approve.assetId,
      });
    }
  });

  test("profile-only rejection persists only the profile reason and independently approves the reviewed video", async () => {
    const reason = "Profile experience claims need clearer evidence.";

    await rejectTeacherApplication(
      seeded.reviewer.userId,
      seeded.rejectProfile.teacherProfileId,
      {
        ...seeded.rejectProfile.guard,
        target: "PROFILE",
        profileReason: reason,
      },
    );

    const state = await loadState(seeded.rejectProfile);
    expect(state.profile).toMatchObject({
      applicationStatus: "REJECTED",
      applicationReviewNote: reason,
    });
    expect(state.video).toMatchObject({
      status: "APPROVED",
      rejectionReason: null,
    });
    expect(state.reconciliations).toHaveLength(0);
    expect(state.audits).toHaveLength(3);
    expect(state.audits.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "VIDEO_APPROVED",
        "PROFILE_REJECTED",
        "APPLICATION_REJECTED",
      ]),
    );
    expect(
      state.audits.find((event) => event.action === "PROFILE_REJECTED"),
    ).toMatchObject({ rejectionTarget: "PROFILE", reason });
    expect(
      state.audits.some((event) => event.action === "VIDEO_REJECTED"),
    ).toBe(false);
  });

  test("video-only rejection persists only the video reason and queues public playback revocation", async () => {
    const reason = "The submitted video audio is not reviewable.";

    await rejectTeacherApplication(
      seeded.reviewer.userId,
      seeded.rejectVideo.teacherProfileId,
      {
        ...seeded.rejectVideo.guard,
        target: "VIDEO",
        videoReason: reason,
      },
    );

    const state = await loadState(seeded.rejectVideo);
    expect(state.profile).toMatchObject({
      applicationStatus: "REJECTED",
      applicationReviewNote: reason,
    });
    expect(state.video).toMatchObject({
      status: "REJECTED",
      rejectionReason: reason,
    });
    expect(state.reconciliations).toHaveLength(1);
    expect(state.reconciliations[0]?.desiredState).toBe("REVOKED");
    expect(state.audits).toHaveLength(2);
    expect(state.audits.map((event) => event.action)).toEqual(
      expect.arrayContaining(["VIDEO_REJECTED", "APPLICATION_REJECTED"]),
    );
    expect(
      state.audits.some((event) => event.action === "PROFILE_REJECTED"),
    ).toBe(false);
  });

  test("a stale review guard is rejected before any durable state, audit, or playback intent changes", async () => {
    await expect(
      approveTeacherApplication(
        seeded.reviewer.userId,
        seeded.stale.teacherProfileId,
        {
          ...seeded.stale.guard,
          profileRevision: seeded.stale.profileRevision - 1,
        },
      ),
    ).rejects.toBeInstanceOf(AdminReviewConflictError);

    const state = await loadState(seeded.stale);
    expect(state.profile.applicationStatus).toBe("PENDING_REVIEW");
    expect(state.video.status).toBe("READY_FOR_REVIEW");
    expect(state.audits).toHaveLength(0);
    expect(state.reconciliations).toHaveLength(0);
  });

  test("two approval submissions produce exactly one committed decision and one conflict", async () => {
    const results = await Promise.allSettled([
      approveTeacherApplication(
        seeded.reviewer.userId,
        seeded.duplicate.teacherProfileId,
        seeded.duplicate.guard,
      ),
      approveTeacherApplication(
        seeded.reviewer.userId,
        seeded.duplicate.teacherProfileId,
        seeded.duplicate.guard,
      ),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBeInstanceOf(AdminReviewConflictError);

    const state = await loadState(seeded.duplicate);
    expect(state.profile.applicationStatus).toBe("APPROVED");
    expect(state.video.status).toBe("APPROVED");
    expect(state.audits).toHaveLength(3);
    expect(state.reconciliations).toHaveLength(1);
  });

  test("an inactive target account causes approval conflict and rolls back the earlier video update", async () => {
    await prisma().user.update({
      where: { id: seeded.inactive.userId },
      data: { accountStatus: "SUSPENDED" },
    });

    await expect(
      approveTeacherApplication(
        seeded.reviewer.userId,
        seeded.inactive.teacherProfileId,
        seeded.inactive.guard,
      ),
    ).rejects.toBeInstanceOf(AdminReviewConflictError);

    const state = await loadState(seeded.inactive);
    expect(state.profile.applicationStatus).toBe("PENDING_REVIEW");
    expect(state.video.status).toBe("READY_FOR_REVIEW");
    expect(state.audits).toHaveLength(0);
    expect(state.reconciliations).toHaveLength(0);
  });

  test("approval racing target-account suspension never commits an approved teacher with stale enabled playback", async () => {
    const results = await Promise.allSettled([
      approveTeacherApplication(
        seeded.reviewer.userId,
        seeded.accountRace.teacherProfileId,
        seeded.accountRace.guard,
      ),
      setAccountStatus(
        seeded.superAdmin.userId,
        seeded.accountRace.userId,
        "SUSPENDED",
        "Concurrent target-account suspension for acceptance testing.",
      ),
    ]);

    expect(
      results.some((result) => result.status === "fulfilled"),
    ).toBe(true);

    for (const result of results) {
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(AdminReviewConflictError);
      }
    }

    const [user, state] = await Promise.all([
      prisma().user.findUniqueOrThrow({
        where: { id: seeded.accountRace.userId },
        select: { accountStatus: true },
      }),
      loadState(seeded.accountRace),
    ]);

    const latestReconciliation = state.reconciliations.at(-1) ?? null;

    if (user.accountStatus === "SUSPENDED") {
      expect(latestReconciliation?.desiredState).toBe("REVOKED");
      expect(["PENDING_REVIEW", "APPROVED"]).toContain(
        state.profile.applicationStatus,
      );
      if (state.profile.applicationStatus === "PENDING_REVIEW") {
        expect(state.video.status).toBe("READY_FOR_REVIEW");
      } else {
        expect(state.video.status).toBe("APPROVED");
      }
    } else {
      expect(user.accountStatus).toBe("ACTIVE");
      expect(state.profile.applicationStatus).toBe("APPROVED");
      expect(state.video.status).toBe("APPROVED");
      expect(latestReconciliation?.desiredState).toBe("ENABLED");
    }
  });

  test("an audit write failure rolls back profile, video, and playback-intent state atomically", async () => {
    const removeFailureTrigger = await installAuditFailureTrigger(seeded.atomic);

    try {
      await expect(
        approveTeacherApplication(
          seeded.reviewer.userId,
          seeded.atomic.teacherProfileId,
          seeded.atomic.guard,
        ),
      ).rejects.toBeDefined();
    } finally {
      await removeFailureTrigger();
    }

    const state = await loadState(seeded.atomic);
    expect(state.profile.applicationStatus).toBe("PENDING_REVIEW");
    expect(state.video.status).toBe("READY_FOR_REVIEW");
    expect(state.audits).toHaveLength(0);
    expect(state.reconciliations).toHaveLength(0);
  });

  test("a moderation transition makes the old review decision incompatible and preserves only authoritative audits", async () => {
    await approveTeacherApplication(
      seeded.reviewer.userId,
      seeded.moderationConflict.teacherProfileId,
      seeded.moderationConflict.guard,
    );

    await setTeacherSuspension(
      seeded.superAdmin.userId,
      seeded.moderationConflict.teacherProfileId,
      true,
      {
        reviewCycle: seeded.moderationConflict.reviewCycle,
        reason: "Temporary teacher access suspension for acceptance testing.",
      },
    );

    await expect(
      rejectTeacherApplication(
        seeded.reviewer.userId,
        seeded.moderationConflict.teacherProfileId,
        {
          ...seeded.moderationConflict.guard,
          target: "PROFILE",
          profileReason: "This stale decision must not persist.",
        },
      ),
    ).rejects.toBeInstanceOf(AdminReviewConflictError);

    const state = await loadState(seeded.moderationConflict);
    expect(state.profile.applicationStatus).toBe("SUSPENDED");
    expect(state.video.status).toBe("APPROVED");
    expect(state.audits).toHaveLength(4);
    expect(state.audits.map((event) => event.action)).toEqual(
      expect.arrayContaining([
        "PROFILE_APPROVED",
        "VIDEO_APPROVED",
        "APPLICATION_APPROVED",
        "TEACHER_SUSPENDED",
      ]),
    );
    expect(
      state.audits.some((event) => event.action === "APPLICATION_REJECTED"),
    ).toBe(false);
  });
});

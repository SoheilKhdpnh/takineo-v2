import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createAdminServiceFixtures } from "@/tests/support/admin-service-fixtures";
import { createTestPrismaClient } from "@/tests/support/test-prisma-client";

const fixtures = createAdminServiceFixtures("moderation_index");

let applicationPrisma: ReturnType<typeof createTestPrismaClient> | null = null;
let listModeratableTeachers: typeof import(
  "@/lib/services/admin-moderation.service"
).listModeratableTeachers;
let AdminForbiddenError: typeof import(
  "@/lib/errors/admin-errors"
).AdminForbiddenError;

async function seedFixtures() {
  const reviewer = await fixtures.createAdministrator({
    key: "reviewer",
    permission: "REVIEWER",
  });
  const superAdmin = await fixtures.createAdministrator({
    key: "super_admin",
    permission: "SUPER_ADMIN",
  });
  const revokedSuperAdmin = await fixtures.createAdministrator({
    key: "revoked_super_admin",
    permission: "SUPER_ADMIN",
    revoked: true,
  });

  const approvedOlder = await fixtures.createTeacherApplicant({
    key: "approved_older",
    applicationStatus: "APPROVED",
  });
  const approvedNewer = await fixtures.createTeacherApplicant({
    key: "approved_newer",
    applicationStatus: "APPROVED",
  });
  const suspended = await fixtures.createTeacherApplicant({
    key: "suspended",
    applicationStatus: "SUSPENDED",
  });
  const pending = await fixtures.createTeacherApplicant({
    key: "pending",
    applicationStatus: "PENDING_REVIEW",
  });

  if (!applicationPrisma) {
    throw new Error("Test Prisma client is unavailable.");
  }

  await applicationPrisma.teacherProfile.update({
    where: { id: approvedOlder.teacherProfileId },
    data: {
      applicationReviewedAt: new Date("2026-08-10T09:00:00.000Z"),
      reviewCycle: 1,
      headline: "Approved older",
    },
  });
  await applicationPrisma.teacherProfile.update({
    where: { id: approvedNewer.teacherProfileId },
    data: {
      applicationReviewedAt: new Date("2026-08-12T09:00:00.000Z"),
      reviewCycle: 2,
      headline: "Approved newer",
    },
  });
  await applicationPrisma.teacherProfile.update({
    where: { id: suspended.teacherProfileId },
    data: {
      applicationReviewedAt: new Date("2026-08-11T09:00:00.000Z"),
      reviewCycle: 3,
      headline: "Suspended teacher",
    },
  });
  await applicationPrisma.teacherProfile.update({
    where: { id: pending.teacherProfileId },
    data: {
      applicationSubmittedAt: new Date("2026-08-13T09:00:00.000Z"),
      reviewCycle: 1,
      headline: "Pending teacher",
    },
  });

  return {
    reviewer,
    superAdmin,
    revokedSuperAdmin,
    approvedOlder,
    approvedNewer,
    suspended,
    pending,
  };
}

let seeded: Awaited<ReturnType<typeof seedFixtures>>;

async function collectModeratableTeachers(status: "APPROVED" | "SUSPENDED") {
  const teachers: Awaited<
    ReturnType<typeof listModeratableTeachers>
  >["teachers"] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < 100; page += 1) {
    const result = await listModeratableTeachers(seeded.superAdmin.userId, {
      status,
      limit: 50,
      ...(cursor ? { cursor } : {}),
    });

    teachers.push(...result.teachers);

    if (!result.nextCursor) {
      return teachers;
    }

    if (seenCursors.has(result.nextCursor)) {
      throw new Error("Moderation pagination repeated a cursor.");
    }

    seenCursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }

  throw new Error("Moderation pagination exceeded the test safety bound.");
}

describe("Wave 1 administrative moderation index", () => {
  beforeAll(async () => {
    await fixtures.connect("takineo-wave1-admin-moderation-index-test");

    applicationPrisma = createTestPrismaClient();

    vi.resetModules();
    vi.doMock("@/lib/db/prisma", () => ({
      prisma: applicationPrisma,
    }));

    const errors = await import("@/lib/errors/admin-errors");
    AdminForbiddenError = errors.AdminForbiddenError;

    const moderationService = await import(
      "@/lib/services/admin-moderation.service"
    );
    listModeratableTeachers = moderationService.listModeratableTeachers;

    seeded = await seedFixtures();
  });

  afterAll(async () => {
    await applicationPrisma?.$disconnect();
    applicationPrisma = null;
    await fixtures.dispose();
    vi.doUnmock("@/lib/db/prisma");
  });

  test("a reviewer cannot enumerate the moderation index", async () => {
    await expect(
      listModeratableTeachers(seeded.reviewer.userId, {
        status: "APPROVED",
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  test("a revoked super-admin cannot enumerate the moderation index", async () => {
    await expect(
      listModeratableTeachers(seeded.revokedSuperAdmin.userId, {
        status: "APPROVED",
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  test("a super-admin sees only approved teachers for the approved filter", async () => {
    const teachers = await collectModeratableTeachers("APPROVED");
    const teacherIds = teachers.map((teacher) => teacher.id);

    expect(teacherIds).toEqual(
      expect.arrayContaining([
        seeded.approvedNewer.teacherProfileId,
        seeded.approvedOlder.teacherProfileId,
      ]),
    );
    expect(teacherIds).not.toContain(seeded.suspended.teacherProfileId);
    expect(teacherIds).not.toContain(seeded.pending.teacherProfileId);
    expect(
      teachers.every((teacher) => teacher.applicationStatus === "APPROVED"),
    ).toBe(true);

    const seededTeacher = teachers.find(
      (teacher) => teacher.id === seeded.approvedNewer.teacherProfileId,
    );

    if (!seededTeacher) {
      throw new Error("Seeded approved teacher was not returned.");
    }

    expect(seededTeacher).not.toHaveProperty("introVideo");
    expect(seededTeacher).not.toHaveProperty("submittedVideoAssetId");
    expect(seededTeacher).not.toHaveProperty("submittedVideoUploadId");
  });

  test("a super-admin sees only suspended teachers for the suspended filter", async () => {
    const teachers = await collectModeratableTeachers("SUSPENDED");
    const teacherIds = teachers.map((teacher) => teacher.id);

    expect(teacherIds).toContain(seeded.suspended.teacherProfileId);
    expect(teacherIds).not.toContain(seeded.approvedOlder.teacherProfileId);
    expect(teacherIds).not.toContain(seeded.approvedNewer.teacherProfileId);
    expect(teacherIds).not.toContain(seeded.pending.teacherProfileId);
    expect(
      teachers.every((teacher) => teacher.applicationStatus === "SUSPENDED"),
    ).toBe(true);

    const seededTeacher = teachers.find(
      (teacher) => teacher.id === seeded.suspended.teacherProfileId,
    );

    expect(seededTeacher).toMatchObject({
      id: seeded.suspended.teacherProfileId,
      applicationStatus: "SUSPENDED",
      reviewCycle: 3,
      headline: "Suspended teacher",
    });
    expect(seededTeacher?.user).toMatchObject({
      accountStatus: "ACTIVE",
    });
  });

  test("cursor pagination is deterministic and excludes the cursor row", async () => {
    const reference = await listModeratableTeachers(seeded.superAdmin.userId, {
      status: "APPROVED",
      limit: 2,
    });

    if (reference.teachers.length < 2) {
      throw new Error("Expected at least two approved teachers for pagination.");
    }

    const [expectedFirst, expectedSecond] = reference.teachers;

    const firstPage = await listModeratableTeachers(seeded.superAdmin.userId, {
      status: "APPROVED",
      limit: 1,
    });

    expect(firstPage.teachers).toHaveLength(1);
    expect(firstPage.teachers[0]?.id).toBe(expectedFirst.id);
    expect(firstPage.nextCursor).toBe(expectedFirst.id);

    const secondPage = await listModeratableTeachers(seeded.superAdmin.userId, {
      status: "APPROVED",
      limit: 1,
      cursor: firstPage.nextCursor!,
    });

    expect(secondPage.teachers).toHaveLength(1);
    expect(secondPage.teachers[0]?.id).toBe(expectedSecond.id);
    expect(secondPage.teachers[0]?.id).not.toBe(expectedFirst.id);
  });
});

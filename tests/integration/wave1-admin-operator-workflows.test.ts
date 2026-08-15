import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createAdminServiceFixtures } from "@/tests/support/admin-service-fixtures";
import { createTestPrismaClient } from "@/tests/support/test-prisma-client";

const fixtures = createAdminServiceFixtures("operator_workflows");

let applicationPrisma: ReturnType<typeof createTestPrismaClient> | null = null;
let setAdministrativeAccess: typeof import("@/lib/services/admin-access.service").setAdministrativeAccess;
let setAccountStatus: typeof import("@/lib/services/admin-access.service").setAccountStatus;
let resolveAdminOperatorUser: typeof import("@/lib/services/admin-operator.service").resolveAdminOperatorUser;
let AdminForbiddenError: typeof import("@/lib/errors/admin-errors").AdminForbiddenError;
let AdminReviewConflictError: typeof import("@/lib/errors/admin-errors").AdminReviewConflictError;

const ids = {
  superAdmin: fixtures.id("super_admin"),
  reviewer: fixtures.id("reviewer"),
  target: fixtures.id("target"),
} as const;

describe("Wave 1 administrative operator workflows", () => {
  beforeAll(async () => {
    await fixtures.connect("takineo-wave1-admin-operator-workflows-test");

    await fixtures.createAdministrator({
      key: "super_admin",
      permission: "SUPER_ADMIN",
      productRole: "STUDENT",
    });
    await fixtures.createAdministrator({
      key: "reviewer",
      permission: "REVIEWER",
      productRole: "STUDENT",
    });
    await fixtures.createUser({ key: "target", role: "STUDENT" });

    applicationPrisma = createTestPrismaClient();
    vi.resetModules();
    vi.doMock("@/lib/db/prisma", () => ({ prisma: applicationPrisma }));

    const errors = await import("@/lib/errors/admin-errors");
    AdminForbiddenError = errors.AdminForbiddenError;
    AdminReviewConflictError = errors.AdminReviewConflictError;

    const access = await import("@/lib/services/admin-access.service");
    setAdministrativeAccess = access.setAdministrativeAccess;
    setAccountStatus = access.setAccountStatus;

    const operator = await import("@/lib/services/admin-operator.service");
    resolveAdminOperatorUser = operator.resolveAdminOperatorUser;
  });

  afterAll(async () => {
    vi.doUnmock("@/lib/db/prisma");
    vi.resetModules();
    await applicationPrisma?.$disconnect();
    applicationPrisma = null;
    await fixtures.dispose();
  });

  test("a REVIEWER cannot grant administrative access", async () => {
    await expect(
      setAdministrativeAccess(
        ids.reviewer,
        ids.target,
        "REVIEWER",
        "review coverage",
      ),
    ).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  test("a SUPER_ADMIN grants REVIEWER access with an auditable reason", async () => {
    await setAdministrativeAccess(
      ids.superAdmin,
      ids.target,
      "REVIEWER",
      "review coverage rotation",
    );

    const [access, event] = await Promise.all([
      applicationPrisma!.adminAccess.findUnique({ where: { userId: ids.target } }),
      applicationPrisma!.adminAuditEvent.findFirst({
        where: { actorUserId: ids.superAdmin, targetUserId: ids.target, action: "ADMIN_ACCESS_GRANTED" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    expect(access).toMatchObject({
      userId: ids.target,
      permission: "REVIEWER",
      revokedAt: null,
    });
    expect(event).toMatchObject({
      reason: "review coverage rotation",
      metadata: { previousPermission: null, newPermission: "REVIEWER" },
    });
  });

  test("permission changes and revocation remain atomic and auditable", async () => {
    await setAdministrativeAccess(
      ids.superAdmin,
      ids.target,
      "SUPER_ADMIN",
      "temporary escalation for incident response",
    );

    await setAdministrativeAccess(
      ids.superAdmin,
      ids.target,
      null,
      "incident response completed",
    );

    const [access, events] = await Promise.all([
      applicationPrisma!.adminAccess.findUnique({ where: { userId: ids.target } }),
      applicationPrisma!.adminAuditEvent.findMany({
        where: {
          actorUserId: ids.superAdmin,
          targetUserId: ids.target,
          action: { in: ["ADMIN_PERMISSION_CHANGED", "ADMIN_ACCESS_REVOKED"] },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    expect(access?.revokedAt).not.toBeNull();
    expect(events.map((event) => [event.action, event.reason])).toEqual([
      ["ADMIN_PERMISSION_CHANGED", "temporary escalation for incident response"],
      ["ADMIN_ACCESS_REVOKED", "incident response completed"],
    ]);
  });

  test("a REVIEWER cannot change account status", async () => {
    await expect(
      setAccountStatus(
        ids.reviewer,
        ids.target,
        "SUSPENDED",
        "manual moderation",
      ),
    ).rejects.toBeInstanceOf(AdminForbiddenError);
  });

  test("account status changes persist their reason and block later admin grants while inactive", async () => {
    await setAccountStatus(
      ids.superAdmin,
      ids.target,
      "SUSPENDED",
      "manual abuse investigation",
    );

    const [target, event] = await Promise.all([
      applicationPrisma!.user.findUnique({ where: { id: ids.target }, select: { accountStatus: true } }),
      applicationPrisma!.adminAuditEvent.findFirst({
        where: { actorUserId: ids.superAdmin, targetUserId: ids.target, action: "ACCOUNT_STATUS_CHANGED" },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    expect(target?.accountStatus).toBe("SUSPENDED");
    expect(event).toMatchObject({
      reason: "manual abuse investigation",
      metadata: { previousAccountStatus: "ACTIVE", newAccountStatus: "SUSPENDED" },
    });

    await expect(
      setAdministrativeAccess(
        ids.superAdmin,
        ids.target,
        "REVIEWER",
        "should fail while suspended",
      ),
    ).rejects.toBeInstanceOf(AdminReviewConflictError);
  });

  test("operator lookup resolves by email and never reports revoked access as active", async () => {
    const resolved = await resolveAdminOperatorUser({
      email: `${ids.target}@example.test`,
    });

    expect(resolved).toEqual({
      id: ids.target,
      name: `Admin service fixture ${ids.target}`,
      email: `${ids.target}@example.test`,
      accountStatus: "SUSPENDED",
      adminPermission: null,
    });
  });
});

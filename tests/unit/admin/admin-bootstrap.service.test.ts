import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runTransaction: vi.fn(),
}));

vi.mock("@/lib/services/admin-transaction", () => ({
  runSerializableAdminTransaction: mocks.runTransaction,
}));

import {
  AdminReviewConflictError,
  AdminTargetNotFoundError,
} from "@/lib/errors/admin-errors";
import { bootstrapInitialSuperAdmin } from "@/lib/services/admin-bootstrap.service";

describe("initial SUPER_ADMIN bootstrap service", () => {
  beforeEach(() => {
    mocks.runTransaction.mockReset();
  });

  it("rejects execution without the exact privileged confirmation", async () => {
    await expect(
      bootstrapInitialSuperAdmin({ userId: "user-1", confirmation: "WRONG" }),
    ).rejects.toBeInstanceOf(AdminReviewConflictError);

    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it("creates the first SUPER_ADMIN and immutable audit event atomically", async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-1", accountStatus: "ACTIVE" }),
      },
      adminAccess: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ userId: "user-1", permission: "SUPER_ADMIN" }),
      },
      adminAuditEvent: {
        create: vi.fn().mockResolvedValue({}),
      },
    };
    mocks.runTransaction.mockImplementation(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx));

    await expect(
      bootstrapInitialSuperAdmin({
        userId: "user-1",
        confirmation: "BOOTSTRAP_INITIAL_SUPER_ADMIN",
      }),
    ).resolves.toEqual({ userId: "user-1", permission: "SUPER_ADMIN" });

    expect(tx.adminAccess.create).toHaveBeenCalledWith({
      data: { userId: "user-1", permission: "SUPER_ADMIN" },
    });
    expect(tx.adminAuditEvent.create).toHaveBeenCalledWith({
      data: {
        actorUserId: "user-1",
        targetUserId: "user-1",
        action: "ADMIN_BOOTSTRAPPED",
        metadata: { permission: "SUPER_ADMIN" },
      },
    });
  });

  it("fails safely for a missing user", async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
      adminAccess: { count: vi.fn().mockResolvedValue(0) },
    };
    mocks.runTransaction.mockImplementation(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx));

    await expect(
      bootstrapInitialSuperAdmin({
        userId: "missing",
        confirmation: "BOOTSTRAP_INITIAL_SUPER_ADMIN",
      }),
    ).rejects.toBeInstanceOf(AdminTargetNotFoundError);
  });

  it("refuses bootstrap when any active administrative access already exists", async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: "user-1", accountStatus: "ACTIVE" }),
      },
      adminAccess: { count: vi.fn().mockResolvedValue(1) },
    };
    mocks.runTransaction.mockImplementation(async (work: (transaction: typeof tx) => Promise<unknown>) => work(tx));

    await expect(
      bootstrapInitialSuperAdmin({
        userId: "user-1",
        confirmation: "BOOTSTRAP_INITIAL_SUPER_ADMIN",
      }),
    ).rejects.toBeInstanceOf(AdminReviewConflictError);
  });
});

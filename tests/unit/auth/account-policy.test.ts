import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

import {
  getAccountStatusForAuth,
  isActiveAccount,
  isInactiveAccountSelfServicePath,
} from "@/lib/auth/account-policy";

describe("inactive account self-service policy", () => {
  it.each([
    "/sign-out",
    "/list-sessions",
    "/revoke-session",
    "/revoke-sessions",
    "/revoke-other-sessions",
  ])("allows %s", (path) => {
    expect(isInactiveAccountSelfServicePath(path)).toBe(true);
  });

  it.each([
    "/api/auth/sign-out",
    "/api/auth/list-sessions",
    "/api/auth/revoke-session",
    "/api/auth/revoke-sessions",
    "/api/auth/revoke-other-sessions",
  ])("normalizes and allows %s", (path) => {
    expect(isInactiveAccountSelfServicePath(path)).toBe(true);
  });

  it.each([
    "/get-session",
    "/api/auth/get-session",
    "/sign-in/email",
    "/api/auth/sign-in/email",
    "/sign-up/email",
    "/api/auth/sign-up/email",
  ])("denies inactive self-service access to %s", (path) => {
    expect(isInactiveAccountSelfServicePath(path)).toBe(false);
  });
});

describe("account status policy", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
  });

  it("returns ACTIVE and considers the account active", async () => {
    mocks.findUnique.mockResolvedValue({
      accountStatus: "ACTIVE",
    });

    await expect(getAccountStatusForAuth("user-active")).resolves.toBe(
      "ACTIVE",
    );

    mocks.findUnique.mockResolvedValue({
      accountStatus: "ACTIVE",
    });

    await expect(isActiveAccount("user-active")).resolves.toBe(true);
  });

  it.each(["SUSPENDED", "DISABLED"] as const)(
    "treats %s as inactive",
    async (accountStatus) => {
      mocks.findUnique.mockResolvedValue({
        accountStatus,
      });

      await expect(isActiveAccount(`user-${accountStatus}`)).resolves.toBe(
        false,
      );
    },
  );

  it("fails closed when the user no longer exists", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(getAccountStatusForAuth("missing-user")).resolves.toBeNull();

    mocks.findUnique.mockResolvedValue(null);

    await expect(isActiveAccount("missing-user")).resolves.toBe(false);
  });
});

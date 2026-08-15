import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { adminPermissionHasCapability } from "@/lib/auth/admin-access";

describe("admin operator capabilities", () => {
  it.each([
    ["REVIEWER", "MODERATE_ACCOUNT", false],
    ["REVIEWER", "MANAGE_ADMIN_ACCESS", false],
    ["SUPER_ADMIN", "MODERATE_ACCOUNT", true],
    ["SUPER_ADMIN", "MANAGE_ADMIN_ACCESS", true],
  ] as const)(
    "%s + %s => %s",
    (permission, capability, expected) => {
      expect(
        adminPermissionHasCapability(permission, capability),
      ).toBe(expected);
    },
  );
});

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAdminCapabilities: vi.fn(),
  getCurrentSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/auth/admin-access", () => ({
  getCurrentAdminCapabilities:
    mocks.getCurrentAdminCapabilities,
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: mocks.getCurrentSession,
}));

vi.mock("@/i18n/navigation", () => ({
  redirect: mocks.redirect,
}));

import { requireAdminPageAccess } from "@/lib/auth/admin-page-guard";
import { AdminForbiddenError } from "@/lib/errors/admin-errors";

class RedirectSignal extends Error {
  constructor(
    readonly destination: {
      href: string;
      locale: "fa" | "en";
    },
  ) {
    super("Redirected");
  }
}

const reviewerCapabilities = {
  userId: "admin-user",
  permission: "REVIEWER" as const,
  capabilities: {
    reviewTeacherApplications: true,
    moderateTeachers: false,
    moderateAccounts: false,
    manageAdminAccess: false,
    manageSessions: false,
  },
};

function session(
  user: Record<string, unknown> = {},
) {
  return {
    user: {
      id: "admin-user",
      ...user,
    },
  };
}

describe("requireAdminPageAccess", () => {
  beforeEach(() => {
    mocks.getCurrentAdminCapabilities.mockReset();
    mocks.getCurrentSession.mockReset();
    mocks.redirect.mockReset();

    mocks.getCurrentSession.mockResolvedValue(
      session(),
    );

    mocks.getCurrentAdminCapabilities.mockResolvedValue(
      reviewerCapabilities,
    );

    mocks.redirect.mockImplementation(
      (destination) => {
        throw new RedirectSignal(destination);
      },
    );
  });

  it.each(["fa", "en"] as const)(
    "redirects a missing %s session to the localized sign-in page before checking admin access",
    async (locale) => {
      mocks.getCurrentSession.mockResolvedValue(null);

      await expect(
        requireAdminPageAccess(locale),
      ).rejects.toMatchObject({
        destination: {
          href: "/sign-in",
          locale,
        },
      });

      expect(
        mocks.getCurrentAdminCapabilities,
      ).not.toHaveBeenCalled();
    },
  );

  it("returns the server-derived session and centralized reviewer capabilities", async () => {
    const currentSession = session();
    mocks.getCurrentSession.mockResolvedValue(
      currentSession,
    );

    await expect(
      requireAdminPageAccess("fa"),
    ).resolves.toEqual({
      session: currentSession,
      admin: reviewerCapabilities,
    });

    expect(
      mocks.getCurrentAdminCapabilities,
    ).toHaveBeenCalledOnce();
    expect(
      mocks.getCurrentAdminCapabilities,
    ).toHaveBeenCalledWith("admin-user");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each(["fa", "en"] as const)(
    "redirects a %s request denied by the centralized admin policy without exposing the reason",
    async (locale) => {
      mocks.getCurrentAdminCapabilities.mockRejectedValue(
        new AdminForbiddenError(),
      );

      await expect(
        requireAdminPageAccess(locale),
      ).rejects.toMatchObject({
        destination: {
          href: "/dashboard",
          locale,
        },
      });

      expect(
        mocks.getCurrentAdminCapabilities,
      ).toHaveBeenCalledWith("admin-user");
    },
  );

  it("propagates unexpected capability failures instead of failing open or disguising them as an authorization redirect", async () => {
    const failure = new Error(
      "Capability store unavailable",
    );

    mocks.getCurrentAdminCapabilities.mockRejectedValue(
      failure,
    );

    await expect(
      requireAdminPageAccess("fa"),
    ).rejects.toBe(failure);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

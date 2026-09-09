import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createAdminServiceFixtures } from "@/tests/support/admin-service-fixtures";
import { createTestPrismaClient } from "@/tests/support/test-prisma-client";

const fixtures = createAdminServiceFixtures("better_auth");

let applicationPrisma: ReturnType<typeof createTestPrismaClient> | null = null;
let auth: typeof import("@/lib/auth/auth").auth;
let getApiSession: typeof import("@/lib/auth/api-session").getApiSession;
let getAdminSession: typeof import("@/app/api/admin/session/route").GET;
let userId: string | null = null;
let sessionCookie = "";
let rawSessionToken = "";
let sessionTokenCookieName = "";

function prisma() {
  if (!applicationPrisma) {
    throw new Error("Better Auth acceptance Prisma is unavailable.");
  }
  return applicationPrisma;
}

function cookiePairsFromSetCookie(headers: Headers): string[] {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(";", 1)[0]);
}

function cookieHeaderFromSetCookie(headers: Headers): string {
  return cookiePairsFromSetCookie(headers).join("; ");
}

function sessionCookieNameFromSetCookie(headers: Headers): string {
  const pair = cookiePairsFromSetCookie(headers).find((cookie) => {
    const separator = cookie.indexOf("=");
    const name = separator === -1 ? cookie : cookie.slice(0, separator);
    return name.endsWith("better-auth.session_token");
  });

  if (!pair) {
    throw new Error("Better Auth did not issue a session-token cookie.");
  }

  return pair.slice(0, pair.indexOf("="));
}

function requestWithCookie(cookie: string) {
  return new Request("http://localhost:3000/api/admin/session", {
    headers: { cookie },
  });
}

describe("Wave 1 Better Auth administrative session acceptance", () => {
  beforeAll(async () => {
    await fixtures.connect("takineo-wave1-admin-better-auth-test");
    applicationPrisma = createTestPrismaClient();

    vi.resetModules();
    vi.doMock("@/lib/db/prisma", () => ({ prisma: applicationPrisma }));

    ({ auth } = await import("@/lib/auth/auth"));
    ({ getApiSession } = await import("@/lib/auth/api-session"));
    ({ GET: getAdminSession } = await import("@/app/api/admin/session/route"));

    const email = `${fixtures.id("login")}_${randomUUID().slice(0, 8)}@example.test`;
    const password = "TakineoBetterAuth!2026";
    const signedUp = await auth.api.signUpEmail({
      returnHeaders: true,
      body: {
        email,
        password,
        name: "Better Auth Admin",
      },
    });

    userId = signedUp.response.user.id;
    sessionCookie = cookieHeaderFromSetCookie(signedUp.headers);
    sessionTokenCookieName = sessionCookieNameFromSetCookie(signedUp.headers);

    if (!sessionCookie) {
      throw new Error("Better Auth did not issue a session cookie.");
    }

    const sessionRow = await prisma().session.findFirstOrThrow({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });
    rawSessionToken = sessionRow.token;

    await prisma().adminAccess.create({
      data: {
        id: fixtures.id("access"),
        userId,
        permission: "SUPER_ADMIN",
      },
    });
  });

  afterAll(async () => {
    try {
      if (userId && applicationPrisma) {
        await applicationPrisma.session.deleteMany({ where: { userId } });
        await applicationPrisma.account.deleteMany({ where: { userId } });
        await applicationPrisma.adminAccess.deleteMany({ where: { userId } });
        await applicationPrisma.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      try {
        await applicationPrisma?.$disconnect();
        applicationPrisma = null;
      } finally {
        await fixtures.dispose();
        vi.doUnmock("@/lib/db/prisma");
        vi.resetModules();
      }
    }
  });

  test("a real Better Auth signed session cookie resolves through the production API-session helper", async () => {
    const session = await getApiSession(requestWithCookie(sessionCookie));

    expect(session?.user).toMatchObject({
      id: userId,
      email: expect.stringContaining("@example.test"),
    });
  });

  test("the real session cookie reaches the admin capability route and product role is not required", async () => {
    const persistedUser = await prisma().user.findUniqueOrThrow({
      where: { id: userId! },
      select: { role: true },
    });
    expect(persistedUser.role).toBeNull();

    const response = await getAdminSession(requestWithCookie(sessionCookie));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      admin: {
        userId,
        permission: "SUPER_ADMIN",
        capabilities: {
          reviewTeacherApplications: true,
          moderateTeachers: true,
          moderateAccounts: true,
          manageAdminAccess: true,
          manageSessions: true,
        },
      },
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  test("Better Auth rejects an unsigned raw database session token cookie", async () => {
    const unsignedCookie = `${sessionTokenCookieName}=${rawSessionToken}`;

    await expect(
      getApiSession(requestWithCookie(unsignedCookie)),
    ).resolves.toBeNull();
  });

  test("an account becoming inactive invalidates the same otherwise-valid Better Auth session", async () => {
    if (!userId) throw new Error("Better Auth fixture user is unavailable.");

    await prisma().user.update({
      where: { id: userId },
      data: { accountStatus: "SUSPENDED" },
    });

    await expect(
      getApiSession(requestWithCookie(sessionCookie)),
    ).resolves.toBeNull();

    const response = await getAdminSession(requestWithCookie(sessionCookie));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "UNAUTHORIZED" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});

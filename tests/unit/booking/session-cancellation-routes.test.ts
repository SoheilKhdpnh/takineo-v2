import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getApiSession:
    vi.fn(),

  getUserAccessContext:
    vi.fn(),

  requireAdminAccess:
    vi.fn(),

  hasTrustedRequestOrigin:
    vi.fn(),

  cancelSpeakingSessionAsStudent:
    vi.fn(),

  cancelSpeakingSessionAsTeacher:
    vi.fn(),

  cancelSpeakingSessionAsAdmin:
    vi.fn(),
}));

vi.mock(
  "@/lib/auth/api-session",
  () => ({
    getApiSession:
      mocks.getApiSession,
  }),
);

vi.mock(
  "@/lib/auth/access",
  () => ({
    getUserAccessContext:
      mocks.getUserAccessContext,
  }),
);

vi.mock(
  "@/lib/auth/admin-access",
  () => ({
    requireAdminAccess:
      mocks.requireAdminAccess,
  }),
);

vi.mock(
  "@/lib/security/same-origin",
  () => ({
    hasTrustedRequestOrigin:
      mocks.hasTrustedRequestOrigin,
  }),
);

vi.mock(
  "@/lib/services/session-cancellation.service",
  () => ({
    cancelSpeakingSessionAsStudent:
      mocks.cancelSpeakingSessionAsStudent,

    cancelSpeakingSessionAsTeacher:
      mocks.cancelSpeakingSessionAsTeacher,

    cancelSpeakingSessionAsAdmin:
      mocks.cancelSpeakingSessionAsAdmin,
  }),
);

import {
  POST as cancelSession,
} from "@/app/api/sessions/[sessionId]/cancel/route";

import {
  POST as cancelSessionAsAdmin,
} from "@/app/api/admin/sessions/[sessionId]/cancel/route";

import {
  AdminForbiddenError,
} from "@/lib/errors/admin-errors";

import {
  SessionCancellationConflictError,
  SessionCancellationCutoffError,
  SessionCancellationForbiddenError,
  SessionCancellationInvariantError,
  SessionCancellationStateError,
  SessionCancellationTargetNotFoundError,
} from "@/lib/errors/session-cancellation-errors";

const validSessionId =
  "session-123";

function session(
  userId = "student-user",
) {
  return {
    user: {
      id: userId,
    },
  };
}

function access(
  role:
    | "STUDENT"
    | "TEACHER"
    | null = "STUDENT",
) {
  return {
    id:
      "user-id",

    role,

    accountStatus:
      "ACTIVE",

    onboardingCompletedAt:
      new Date(),

    studentProfile:
      role === "STUDENT"
        ? {
            id:
              "student-profile",
            profileCompletedAt:
              new Date(),
          }
        : null,

    teacherProfile:
      role === "TEACHER"
        ? {
            id:
              "teacher-profile",

            applicationStatus:
              "APPROVED",

            profileCompletedAt:
              new Date(),

            introVideo: {
              id:
                "video-id",

              status:
                "APPROVED",

              durationSeconds:
                90,
            },
          }
        : null,
  };
}

function context(
  sessionId =
    validSessionId,
) {
  return {
    params:
      Promise.resolve({
        sessionId,
      }),
  };
}

function request(
  body:
    string | undefined =
      "{}",
) {
  return new Request(
    `http://localhost:3000/api/sessions/${validSessionId}/cancel`,
    {
      method:
        "POST",

      headers: {
        "Content-Type":
          "application/json",

        Origin:
          "http://localhost:3000",
      },

      ...(body === undefined
        ? {}
        : {
            body,
          }),
    },
  );
}

function adminRequest(
  body:
    string | undefined =
      JSON.stringify({
        reason:
          "Administrative cancellation.",
      }),
) {
  return new Request(
    `http://localhost:3000/api/admin/sessions/${validSessionId}/cancel`,
    {
      method:
        "POST",

      headers: {
        "Content-Type":
          "application/json",

        Origin:
          "http://localhost:3000",
      },

      ...(body === undefined
        ? {}
        : {
            body,
          }),
    },
  );
}

const successfulResult = {
  session: {
    id:
      validSessionId,
  },

  cancellation: {
    id:
      "cancellation-id",

    actorType:
      "STUDENT",
  },

  alreadyCancelled:
    false,
};

let consoleErrorSpy:
  ReturnType<
    typeof vi.spyOn
  >;

describe(
  "speaking-session cancellation routes",
  () => {
    beforeEach(() => {
      mocks.getApiSession
        .mockReset();

      mocks.getUserAccessContext
        .mockReset();

      mocks.requireAdminAccess
        .mockReset();

      mocks.hasTrustedRequestOrigin
        .mockReset();

      mocks.cancelSpeakingSessionAsStudent
        .mockReset();

      mocks.cancelSpeakingSessionAsTeacher
        .mockReset();

      mocks.cancelSpeakingSessionAsAdmin
        .mockReset();

      mocks.hasTrustedRequestOrigin
        .mockReturnValue(
          true,
        );

      mocks.getApiSession
        .mockResolvedValue(
          session(),
        );

      mocks.getUserAccessContext
        .mockResolvedValue(
          access(
            "STUDENT",
          ),
        );

      mocks.requireAdminAccess
        .mockResolvedValue({
          permission:
            "SUPER_ADMIN",
        });

      mocks.cancelSpeakingSessionAsStudent
        .mockResolvedValue(
          successfulResult,
        );

      mocks.cancelSpeakingSessionAsTeacher
        .mockResolvedValue(
          successfulResult,
        );

      mocks.cancelSpeakingSessionAsAdmin
        .mockResolvedValue(
          successfulResult,
        );

      consoleErrorSpy =
        vi
          .spyOn(
            console,
            "error",
          )
          .mockImplementation(
            () =>
              undefined,
          );
    });

    afterEach(() => {
      consoleErrorSpy
        .mockRestore();
    });

    describe(
      "student and teacher endpoint",
      () => {
        it(
          "rejects an untrusted origin before authentication",
          async () => {
            mocks.hasTrustedRequestOrigin
              .mockReturnValue(
                false,
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              403,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "UNTRUSTED_ORIGIN",
            });

            expect(
              mocks.getApiSession,
            ).not.toHaveBeenCalled();

            expect(
              mocks.cancelSpeakingSessionAsStudent,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "returns 401 when there is no active authenticated session",
          async () => {
            mocks.getApiSession
              .mockResolvedValue(
                null,
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              401,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "UNAUTHORIZED",
            });

            expect(
              mocks.getUserAccessContext,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "rejects an unsupported product role",
          async () => {
            mocks.getUserAccessContext
              .mockResolvedValue(
                access(
                  null,
                ),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              403,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "SESSION_CANCELLATION_FORBIDDEN",
            });

            expect(
              mocks.cancelSpeakingSessionAsStudent,
            ).not.toHaveBeenCalled();

            expect(
              mocks.cancelSpeakingSessionAsTeacher,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "returns 400 for invalid JSON",
          async () => {
            const response =
              await cancelSession(
                request(
                  "{",
                ),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              400,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "INVALID_JSON",
            });

            expect(
              mocks.cancelSpeakingSessionAsStudent,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "uses the route session ID as the only session identifier",
          async () => {
            const response =
              await cancelSession(
                request(
                  JSON.stringify({
                    reason:
                      "Changed plans.",
                  }),
                ),
                context(
                  "route-session-id",
                ),
              );

            expect(
              response.status,
            ).toBe(
              200,
            );

            expect(
              mocks.cancelSpeakingSessionAsStudent,
            ).toHaveBeenCalledWith(
              "student-user",
              {
                sessionId:
                  "route-session-id",

                reason:
                  "Changed plans.",
              },
            );
          },
        );

        it(
          "rejects a body-level sessionId instead of allowing it to override the route",
          async () => {
            const response =
              await cancelSession(
                request(
                  JSON.stringify({
                    sessionId:
                      "attacker-controlled-session",

                    reason:
                      "Changed plans.",
                  }),
                ),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              400,
            );

            expect(
              mocks.cancelSpeakingSessionAsStudent,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "dispatches STUDENT cancellation without requiring a reason",
          async () => {
            const response =
              await cancelSession(
                request(
                  "{}",
                ),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              200,
            );

            expect(
              mocks.cancelSpeakingSessionAsStudent,
            ).toHaveBeenCalledWith(
              "student-user",
              {
                sessionId:
                  validSessionId,
              },
            );

            expect(
              mocks.cancelSpeakingSessionAsTeacher,
            ).not.toHaveBeenCalled();

            expect(
              response.headers.get(
                "cache-control",
              ),
            ).toBe(
              "private, no-store",
            );
          },
        );

        it(
          "requires a cancellation reason for a TEACHER",
          async () => {
            mocks.getApiSession
              .mockResolvedValue(
                session(
                  "teacher-user",
                ),
              );

            mocks.getUserAccessContext
              .mockResolvedValue(
                access(
                  "TEACHER",
                ),
              );

            const response =
              await cancelSession(
                request(
                  "{}",
                ),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              400,
            );

            expect(
              mocks.cancelSpeakingSessionAsTeacher,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "dispatches TEACHER cancellation with a reason",
          async () => {
            mocks.getApiSession
              .mockResolvedValue(
                session(
                  "teacher-user",
                ),
              );

            mocks.getUserAccessContext
              .mockResolvedValue(
                access(
                  "TEACHER",
                ),
              );

            const response =
              await cancelSession(
                request(
                  JSON.stringify({
                    reason:
                      "Unable to teach.",
                  }),
                ),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              200,
            );

            expect(
              mocks.cancelSpeakingSessionAsTeacher,
            ).toHaveBeenCalledWith(
              "teacher-user",
              {
                sessionId:
                  validSessionId,

                reason:
                  "Unable to teach.",
              },
            );

            expect(
              mocks.cancelSpeakingSessionAsStudent,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "maps inaccessible sessions to 404",
          async () => {
            mocks.cancelSpeakingSessionAsStudent
              .mockRejectedValue(
                new SessionCancellationTargetNotFoundError(),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              404,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "SESSION_NOT_FOUND",
            });
          },
        );

        it(
          "maps forbidden cancellation to 403",
          async () => {
            mocks.cancelSpeakingSessionAsStudent
              .mockRejectedValue(
                new SessionCancellationForbiddenError(),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              403,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "SESSION_CANCELLATION_FORBIDDEN",
            });
          },
        );

        it(
          "maps the student cutoff to 409",
          async () => {
            mocks.cancelSpeakingSessionAsStudent
              .mockRejectedValue(
                new SessionCancellationCutoffError(),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              409,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "CANCELLATION_CUTOFF",
            });
          },
        );

        it(
          "maps session state conflicts to 409 with the stable state",
          async () => {
            mocks.cancelSpeakingSessionAsStudent
              .mockRejectedValue(
                new SessionCancellationStateError(
                  "COMPLETED",
                ),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              409,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "SESSION_STATE_CONFLICT",

              state:
                "COMPLETED",
            });
          },
        );

        it(
          "maps concurrency conflicts to retryable 409 semantics",
          async () => {
            mocks.cancelSpeakingSessionAsStudent
              .mockRejectedValue(
                new SessionCancellationConflictError(),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              409,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "SESSION_CANCELLATION_CONFLICT",
            });
          },
        );

        it(
          "does not expose cancellation invariant details",
          async () => {
            mocks.cancelSpeakingSessionAsStudent
              .mockRejectedValue(
                new SessionCancellationInvariantError(),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              500,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "INTERNAL_SERVER_ERROR",
            });

            expect(
              consoleErrorSpy,
            ).toHaveBeenCalled();
          },
        );

        it(
          "returns a generic 500 for an unexpected service failure",
          async () => {
            mocks.cancelSpeakingSessionAsStudent
              .mockRejectedValue(
                new Error(
                  "database details",
                ),
              );

            const response =
              await cancelSession(
                request(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              500,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "INTERNAL_SERVER_ERROR",
            });

            expect(
              consoleErrorSpy,
            ).toHaveBeenCalled();
          },
        );
      },
    );

    describe(
      "admin endpoint",
      () => {
        beforeEach(() => {
          mocks.getApiSession
            .mockResolvedValue(
              session(
                "admin-user",
              ),
            );
        });

        it(
          "rejects an untrusted origin before authentication",
          async () => {
            mocks.hasTrustedRequestOrigin
              .mockReturnValue(
                false,
              );

            const response =
              await cancelSessionAsAdmin(
                adminRequest(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              403,
            );

            expect(
              mocks.getApiSession,
            ).not.toHaveBeenCalled();

            expect(
              mocks.requireAdminAccess,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "returns 401 before admin authorization without an active session",
          async () => {
            mocks.getApiSession
              .mockResolvedValue(
                null,
              );

            const response =
              await cancelSessionAsAdmin(
                adminRequest(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              401,
            );

            expect(
              mocks.requireAdminAccess,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "requires MANAGE_SESSIONS before parsing the cancellation body",
          async () => {
            mocks.requireAdminAccess
              .mockRejectedValue(
                new AdminForbiddenError(),
              );

            const response =
              await cancelSessionAsAdmin(
                adminRequest(
                  "{",
                ),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              403,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "ADMIN_FORBIDDEN",
            });

            expect(
              mocks.requireAdminAccess,
            ).toHaveBeenCalledWith(
              "admin-user",
              "MANAGE_SESSIONS",
            );

            expect(
              mocks.cancelSpeakingSessionAsAdmin,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "requires an admin cancellation reason",
          async () => {
            const response =
              await cancelSessionAsAdmin(
                adminRequest(
                  "{}",
                ),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              400,
            );

            expect(
              mocks.cancelSpeakingSessionAsAdmin,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "dispatches an authorized admin cancellation",
          async () => {
            const response =
              await cancelSessionAsAdmin(
                adminRequest(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              200,
            );

            expect(
              mocks.requireAdminAccess,
            ).toHaveBeenCalledWith(
              "admin-user",
              "MANAGE_SESSIONS",
            );

            expect(
              mocks.cancelSpeakingSessionAsAdmin,
            ).toHaveBeenCalledWith(
              "admin-user",
              {
                sessionId:
                  validSessionId,

                reason:
                  "Administrative cancellation.",
              },
            );

            expect(
              response.headers.get(
                "cache-control",
              ),
            ).toBe(
              "private, no-store",
            );
          },
        );

        it(
          "validates the route session ID before invoking the service",
          async () => {
            const response =
              await cancelSessionAsAdmin(
                adminRequest(),
                context(
                  "bad session id",
                ),
              );

            expect(
              response.status,
            ).toBe(
              400,
            );

            expect(
              mocks.cancelSpeakingSessionAsAdmin,
            ).not.toHaveBeenCalled();
          },
        );

        it(
          "maps cancellation domain conflicts through the shared HTTP contract",
          async () => {
            mocks.cancelSpeakingSessionAsAdmin
              .mockRejectedValue(
                new SessionCancellationStateError(
                  "STARTED",
                ),
              );

            const response =
              await cancelSessionAsAdmin(
                adminRequest(),
                context(),
              );

            expect(
              response.status,
            ).toBe(
              409,
            );

            await expect(
              response.json(),
            ).resolves.toEqual({
              error:
                "SESSION_STATE_CONFLICT",

              state:
                "STARTED",
            });
          },
        );
      },
    );
  },
);

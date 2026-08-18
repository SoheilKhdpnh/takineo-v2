import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    getApiSession:
      vi.fn(),

    hasTrustedRequestOrigin:
      vi.fn(),

    getTeacherAvailabilityForUser:
      vi.fn(),

    replaceTeacherWeeklyAvailability:
      vi.fn(),

    createTeacherAvailabilityException:
      vi.fn(),

    deleteTeacherAvailabilityException:
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
  "@/lib/security/same-origin",
  () => ({
    hasTrustedRequestOrigin:
      mocks.hasTrustedRequestOrigin,
  }),
);

vi.mock(
  "@/lib/services/teacher-availability.service",
  () => ({
    getTeacherAvailabilityForUser:
      mocks.getTeacherAvailabilityForUser,

    replaceTeacherWeeklyAvailability:
      mocks.replaceTeacherWeeklyAvailability,

    createTeacherAvailabilityException:
      mocks.createTeacherAvailabilityException,

    deleteTeacherAvailabilityException:
      mocks.deleteTeacherAvailabilityException,
  }),
);

import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";

import {
  TeacherAvailabilityConflictError,
  TeacherAvailabilityExceptionNotFoundError,
  TeacherAvailabilityRangeError,
  TeacherAvailabilityStateError,
} from "@/lib/errors/teacher-availability-errors";

import {
  teacherAvailabilityErrorResponse,
} from "@/lib/errors/teacher-availability-http";

import {
  dynamic,
  GET as getAvailability,
  POST as createException,
  PUT as replaceAvailability,
  runtime,
} from "@/app/api/profile/teacher/availability/route";

import {
  DELETE as deleteException,
  dynamic as deleteDynamic,
  runtime as deleteRuntime,
} from "@/app/api/profile/teacher/availability/exceptions/[exceptionId]/route";

const USER_ID =
  "teacher-user-1";

const SESSION = {
  user: {
    id:
      USER_ID,
  },
};

const RULE = {
  id:
    "rule-1",

  teacherProfileId:
    "teacher-profile-1",

  weekday:
    "SATURDAY",

  startMinute:
    540,

  endMinute:
    600,

  isActive:
    true,

  createdAt:
    new Date(
      "2026-08-18T00:00:00.000Z",
    ),

  updatedAt:
    new Date(
      "2026-08-18T00:00:00.000Z",
    ),
};

const EXCEPTION = {
  id:
    "exception-1",

  teacherProfileId:
    "teacher-profile-1",

  date:
    "2026-08-20",

  startMinute:
    540,

  endMinute:
    600,

  type:
    "UNAVAILABLE",

  note:
    "Appointment",

  createdAt:
    new Date(
      "2026-08-18T00:00:00.000Z",
    ),

  updatedAt:
    new Date(
      "2026-08-18T00:00:00.000Z",
    ),
};

const READ_URL =
  "http://localhost:3000" +
  "/api/profile/teacher/availability" +
  "?fromDate=2026-08-18" +
  "&toDate=2026-08-24";

function mutationRequest(
  method:
    "PUT" |
    "POST",
  body:
    string,
): Request {
  return new Request(
    "http://localhost:3000/api/profile/teacher/availability",
    {
      method,

      headers: {
        "content-type":
          "application/json",

        origin:
          "http://localhost:3000",
      },

      body,
    },
  );
}

function deleteRequest():
  Request {
  return new Request(
    "http://localhost:3000" +
      "/api/profile/teacher/availability" +
      "/exceptions/exception-1",
    {
      method:
        "DELETE",

      headers: {
        origin:
          "http://localhost:3000",
      },
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks
    .getApiSession
    .mockResolvedValue(
      SESSION,
    );

  mocks
    .hasTrustedRequestOrigin
    .mockReturnValue(
      true,
    );

  mocks
    .getTeacherAvailabilityForUser
    .mockResolvedValue({
      rules: [
        RULE,
      ],

      exceptions: [
        EXCEPTION,
      ],
    });

  mocks
    .replaceTeacherWeeklyAvailability
    .mockResolvedValue([
      RULE,
    ]);

  mocks
    .createTeacherAvailabilityException
    .mockResolvedValue(
      EXCEPTION,
    );

  mocks
    .deleteTeacherAvailabilityException
    .mockResolvedValue(
      undefined,
    );
});

describe(
  "teacher availability HTTP error contract",
  () => {
    it.each([
      [
        new ProfileRoleMismatchError(),
        403,
        "FORBIDDEN_PROFILE_TYPE",
      ],

      [
        new ProfileNotFoundError(),
        404,
        "PROFILE_NOT_FOUND",
      ],

      [
        new TeacherAvailabilityStateError(),
        409,
        "TEACHER_AVAILABILITY_STATE_CONFLICT",
      ],

      [
        new TeacherAvailabilityConflictError(),
        409,
        "TEACHER_AVAILABILITY_CONFLICT",
      ],

      [
        new TeacherAvailabilityExceptionNotFoundError(),
        404,
        "TEACHER_AVAILABILITY_EXCEPTION_NOT_FOUND",
      ],

      [
        new TeacherAvailabilityRangeError(
          "INVALID_DATE_RANGE",
        ),
        400,
        "INVALID_DATE_RANGE",
      ],

      [
        new TeacherAvailabilityRangeError(
          "RANGE_TOO_LARGE",
        ),
        400,
        "RANGE_TOO_LARGE",
      ],
    ])(
      "maps %s to HTTP %s / %s",
      async (
        error,
        status,
        code,
      ) => {
        const response =
          teacherAvailabilityErrorResponse(
            error,
          );

        expect(
          response.status,
        ).toBe(
          status,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            code,
        });
      },
    );

    it(
      "sanitizes unexpected internal errors",
      async () => {
        const response =
          teacherAvailabilityErrorResponse(
            new Error(
              "postgresql://private:secret@db/internal",
            ),
          );

        expect(
          response.status,
        ).toBe(
          500,
        );

        const body =
          await response.json();

        expect(
          body,
        ).toEqual({
          error:
            "INTERNAL_SERVER_ERROR",
        });

        expect(
          JSON.stringify(
            body,
          ),
        ).not.toContain(
          "secret",
        );
      },
    );
  },
);

describe(
  "teacher availability collection route",
  () => {
    it(
      "is explicitly Node.js and dynamic",
      () => {
        expect(
          runtime,
        ).toBe(
          "nodejs",
        );

        expect(
          dynamic,
        ).toBe(
          "force-dynamic",
        );
      },
    );

    it(
      "requires authentication for reads",
      async () => {
        mocks
          .getApiSession
          .mockResolvedValueOnce(
            null,
          );

        const response =
          await getAvailability(
            new Request(
              READ_URL,
            ),
          );

        expect(
          response.status,
        ).toBe(
          401,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            "UNAUTHORIZED",
        });

        expect(
          mocks
            .getTeacherAvailabilityForUser,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "reads weekly rules and bounded exceptions through the domain service",
      async () => {
        const response =
          await getAvailability(
            new Request(
              READ_URL,
            ),
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );

        expect(
          mocks
            .getTeacherAvailabilityForUser,
        ).toHaveBeenCalledWith(
          USER_ID,
          {
            fromDate:
              "2026-08-18",

            toDate:
              "2026-08-24",
          },
        );

        const body =
          await response.json();

        expect(
          body.availability.rules[0],
        ).toEqual(
          expect.objectContaining({
            id:
              "rule-1",

            weekday:
              "SATURDAY",

            startMinute:
              540,

            endMinute:
              600,
          }),
        );

        expect(
          body.availability.exceptions[0],
        ).toEqual(
          expect.objectContaining({
            id:
              "exception-1",

            date:
              "2026-08-20",

            type:
              "UNAVAILABLE",
          }),
        );

        expect(
          body.availability.rules[0]
            .createdAt,
        ).toBe(
          "2026-08-18T00:00:00.000Z",
        );
      },
    );

    it.each([
      [
        "missing fromDate",
        "http://localhost:3000/api/profile/teacher/availability" +
          "?toDate=2026-08-24",
      ],

      [
        "missing toDate",
        "http://localhost:3000/api/profile/teacher/availability" +
          "?fromDate=2026-08-18",
      ],

      [
        "duplicate range key",
        READ_URL +
          "&fromDate=2026-08-19",
      ],

      [
        "unknown parameter",
        READ_URL +
          "&teacherProfileId=someone-else",
      ],
    ])(
      "rejects %s before service access",
      async (
        _label,
        url,
      ) => {
        const response =
          await getAvailability(
            new Request(
              url,
            ),
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
            "INVALID_REQUEST",
        });

        expect(
          mocks
            .getTeacherAvailabilityForUser,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "delegates semantic range validation to the service",
      async () => {
        mocks
          .getTeacherAvailabilityForUser
          .mockRejectedValueOnce(
            new TeacherAvailabilityRangeError(
              "RANGE_TOO_LARGE",
            ),
          );

        const response =
          await getAvailability(
            new Request(
              READ_URL,
            ),
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
            "RANGE_TOO_LARGE",
        });
      },
    );

    it(
      "checks trusted origin before authentication on weekly replacement",
      async () => {
        mocks
          .hasTrustedRequestOrigin
          .mockReturnValueOnce(
            false,
          );

        const response =
          await replaceAvailability(
            mutationRequest(
              "PUT",
              JSON.stringify({
                rules:
                  [],
              }),
            ),
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
          mocks
            .replaceTeacherWeeklyAvailability,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "returns INVALID_JSON for malformed weekly replacement JSON",
      async () => {
        const response =
          await replaceAvailability(
            mutationRequest(
              "PUT",
              "{",
            ),
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
          mocks
            .replaceTeacherWeeklyAvailability,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "rejects invalid weekly schedule data before service access",
      async () => {
        const response =
          await replaceAvailability(
            mutationRequest(
              "PUT",
              JSON.stringify({
                rules: [
                  {
                    weekday:
                      "SATURDAY",

                    startMinute:
                      541,

                    endMinute:
                      600,

                    isActive:
                      true,
                  },
                ],
              }),
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        const body =
          await response.json();

        expect(
          body.error,
        ).toBe(
          "INVALID_REQUEST",
        );

        expect(
          mocks
            .replaceTeacherWeeklyAvailability,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "replaces the complete weekly schedule through the authoritative service",
      async () => {
        const input = {
          rules: [
            {
              weekday:
                "SATURDAY",

              startMinute:
                540,

              endMinute:
                600,

              isActive:
                true,
            },
          ],
        };

        const response =
          await replaceAvailability(
            mutationRequest(
              "PUT",
              JSON.stringify(
                input,
              ),
            ),
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          mocks
            .replaceTeacherWeeklyAvailability,
        ).toHaveBeenCalledWith(
          USER_ID,
          input,
        );

        const body =
          await response.json();

        expect(
          body.rules,
        ).toHaveLength(
          1,
        );

        expect(
          body.rules[0].id,
        ).toBe(
          "rule-1",
        );
      },
    );

    it(
      "creates an exception through the authoritative service",
      async () => {
        const input = {
          date:
            "2026-08-20",

          startMinute:
            540,

          endMinute:
            600,

          type:
            "UNAVAILABLE",

          note:
            "Appointment",
        };

        const response =
          await createException(
            mutationRequest(
              "POST",
              JSON.stringify(
                input,
              ),
            ),
          );

        expect(
          response.status,
        ).toBe(
          201,
        );

        expect(
          mocks
            .createTeacherAvailabilityException,
        ).toHaveBeenCalledWith(
          USER_ID,
          input,
        );

        const body =
          await response.json();

        expect(
          body.exception,
        ).toEqual(
          expect.objectContaining({
            id:
              "exception-1",

            date:
              "2026-08-20",

            type:
              "UNAVAILABLE",
          }),
        );
      },
    );

    it(
      "rejects invalid exception input before service access",
      async () => {
        const response =
          await createException(
            mutationRequest(
              "POST",
              JSON.stringify({
                date:
                  "2026-08-20",

                startMinute:
                  541,

                endMinute:
                  600,

                type:
                  "UNAVAILABLE",
              }),
            ),
          );

        expect(
          response.status,
        ).toBe(
          400,
        );

        expect(
          mocks
            .createTeacherAvailabilityException,
        ).not.toHaveBeenCalled();
      },
    );
  },
);

describe(
  "teacher availability exception delete route",
  () => {
    it(
      "is explicitly Node.js and dynamic",
      () => {
        expect(
          deleteRuntime,
        ).toBe(
          "nodejs",
        );

        expect(
          deleteDynamic,
        ).toBe(
          "force-dynamic",
        );
      },
    );

    it(
      "requires trusted origin before authentication",
      async () => {
        mocks
          .hasTrustedRequestOrigin
          .mockReturnValueOnce(
            false,
          );

        const response =
          await deleteException(
            deleteRequest(),
            {
              params:
                Promise.resolve({
                  exceptionId:
                    "exception-1",
                }),
            },
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
          mocks
            .deleteTeacherAvailabilityException,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "deletes only through the authenticated teacher-scoped service",
      async () => {
        const response =
          await deleteException(
            deleteRequest(),
            {
              params:
                Promise.resolve({
                  exceptionId:
                    "exception-1",
                }),
            },
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );

        expect(
          mocks
            .deleteTeacherAvailabilityException,
        ).toHaveBeenCalledWith(
          USER_ID,
          "exception-1",
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          deleted:
            true,
        });
      },
    );

    it(
      "maps another or missing teacher exception to stable 404",
      async () => {
        mocks
          .deleteTeacherAvailabilityException
          .mockRejectedValueOnce(
            new TeacherAvailabilityExceptionNotFoundError(),
          );

        const response =
          await deleteException(
            deleteRequest(),
            {
              params:
                Promise.resolve({
                  exceptionId:
                    "another-teachers-exception",
                }),
            },
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
            "TEACHER_AVAILABILITY_EXCEPTION_NOT_FOUND",
        });
      },
    );
  },
);

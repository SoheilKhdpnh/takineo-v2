import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  getApiSession: vi.fn(),
  hasTrustedRequestOrigin: vi.fn(),
  getTeacherAvailabilityForUser: vi.fn(),
  replaceTeacherWeeklyAvailability: vi.fn(),
  createTeacherAvailabilityException: vi.fn(),
  deleteTeacherAvailabilityException: vi.fn(),
}));

vi.mock(
  "@/lib/auth/api-session",
  () => ({
    getApiSession: mocks.getApiSession,
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
  GET as getAvailabilityRoute,
  PUT as putAvailabilityRoute,
} from "@/app/api/profile/teacher/availability/route";
import {
  getTeacherAvailabilityReadRange,
  parseTeacherAvailabilityErrorCode,
  parseTeacherAvailabilityRulesResponse,
  parseTeacherAvailabilitySnapshotResponse,
  replaceTeacherAvailability,
  TeacherAvailabilityApiError,
} from "@/components/availability/teacher-availability-api";

const rule = {
  id: "rule-1",
  teacherProfileId:
    "teacher-profile-1",
  weekday: "SATURDAY" as const,
  startMinute: 540,
  endMinute: 600,
  isActive: true,
  createdAt: new Date(
    "2026-08-18T00:00:00.000Z",
  ),
  updatedAt: new Date(
    "2026-08-18T00:00:00.000Z",
  ),
};

const exception = {
  id: "exception-1",
  teacherProfileId:
    "teacher-profile-1",
  date: "2026-08-20",
  startMinute: 540,
  endMinute: 600,
  type: "UNAVAILABLE" as const,
  note: "Appointment",
  createdAt: new Date(
    "2026-08-18T00:00:00.000Z",
  ),
  updatedAt: new Date(
    "2026-08-18T00:00:00.000Z",
  ),
};

function jsonRule() {
  return {
    ...rule,
    createdAt:
      rule.createdAt.toISOString(),
    updatedAt:
      rule.updatedAt.toISOString(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();

  mocks.getApiSession.mockResolvedValue({
    user: {
      id: "teacher-user-1",
    },
  });
  mocks.hasTrustedRequestOrigin.mockReturnValue(
    true,
  );
  mocks.getTeacherAvailabilityForUser.mockResolvedValue({
    rules: [rule],
    exceptions: [exception],
  });
  mocks.replaceTeacherWeeklyAvailability.mockResolvedValue([
    rule,
  ]);
});

describe("teacher availability client transport", () => {
  it("accepts the actual Track A GET availability JSON shape", async () => {
    const response =
      await getAvailabilityRoute(
        new Request(
          "http://localhost:3000/api/profile/teacher/availability" +
            "?fromDate=2026-08-18" +
            "&toDate=2026-09-17",
        ),
      );

    expect(response.status).toBe(200);

    expect(
      parseTeacherAvailabilitySnapshotResponse(
        await response.json(),
      ),
    ).toEqual({
      rules: [jsonRule()],
      exceptions: [
        {
          ...exception,
          createdAt:
            exception.createdAt.toISOString(),
          updatedAt:
            exception.updatedAt.toISOString(),
        },
      ],
    });
  });

  it("accepts Track A's complete weekly replacement success shape including an empty schedule", async () => {
    mocks.replaceTeacherWeeklyAvailability.mockResolvedValueOnce(
      [],
    );

    const response =
      await putAvailabilityRoute(
        new Request(
          "http://localhost:3000/api/profile/teacher/availability",
          {
            method: "PUT",
            headers: {
              origin:
                "http://localhost:3000",
              "content-type":
                "application/json",
            },
            body: JSON.stringify({
              rules: [],
            }),
          },
        ),
      );

    expect(response.status).toBe(200);
    expect(
      parseTeacherAvailabilityRulesResponse(
        await response.json(),
      ),
    ).toEqual([]);
  });

  it("derives the B3 read window from Track A's shared Tehran booking horizon", () => {
    expect(
      getTeacherAvailabilityReadRange(
        new Date(
          "2026-08-17T22:00:00.000Z",
        ),
      ),
    ).toEqual({
      fromDate: "2026-08-18",
      toDate: "2026-09-17",
    });
  });

  it("fails closed on malformed or duplicate availability DTOs", () => {
    expect(
      parseTeacherAvailabilitySnapshotResponse({
        availability: {
          rules: [
            {
              ...jsonRule(),
              startMinute: 541,
            },
          ],
          exceptions: [],
        },
      }),
    ).toBeNull();

    expect(
      parseTeacherAvailabilitySnapshotResponse({
        availability: {
          rules: [
            jsonRule(),
            jsonRule(),
          ],
          exceptions: [],
        },
      }),
    ).toBeNull();
  });

  it("recognizes only the stable Track A error field contract", () => {
    expect(
      parseTeacherAvailabilityErrorCode({
        error:
          "TEACHER_AVAILABILITY_CONFLICT",
        message:
          "must not be parsed",
      }),
    ).toBe(
      "TEACHER_AVAILABILITY_CONFLICT",
    );

    expect(
      parseTeacherAvailabilityErrorCode({
        error: "SOMETHING_NEW",
      }),
    ).toBeNull();
  });

  it("submits the complete desired weekly schedule without adding client authorization headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          rules: [jsonRule()],
        }),
      );

    await replaceTeacherAvailability([
      {
        weekday: "SATURDAY",
        startMinute: 540,
        endMinute: 600,
        isActive: true,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] =
      fetchMock.mock.calls[0] ?? [];

    expect(url).toBe(
      "/api/profile/teacher/availability",
    );
    expect(init).toEqual(
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          rules: [
            {
              weekday:
                "SATURDAY",
              startMinute: 540,
              endMinute: 600,
              isActive: true,
            },
          ],
        }),
      }),
    );
    expect(
      new Headers(init?.headers).has(
        "origin",
      ),
    ).toBe(false);
  });

  it("surfaces a 409 by its stable error code instead of parsing a message", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json(
          {
            error:
              "TEACHER_AVAILABILITY_CONFLICT",
            message:
              "ignored text",
          },
          {
            status: 409,
          },
        ),
      );

    await expect(
      replaceTeacherAvailability([]),
    ).rejects.toMatchObject({
      name:
        "TeacherAvailabilityApiError",
      status: 409,
      code:
        "TEACHER_AVAILABILITY_CONFLICT",
    } satisfies Partial<TeacherAvailabilityApiError>);
  });
});

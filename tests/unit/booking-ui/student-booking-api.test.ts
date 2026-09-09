import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  buildTeacherDetailUrl,
  buildTeacherSlotsUrl,
  createStudentBooking,
  generateBookingIdempotencyKey,
  getBookableSlots,
  getPublicTeacherDetail,
  parseBookableSlotsResponse,
  parseCreatedBookingResponse,
  parsePublicTeacherDetailResponse,
} from "@/components/booking/student-booking-api";

const teacher = {
  teacherProfileId:
    "teacher-profile-1",
  name: "Teacher One",
  image: null,
  headline: "Speaking coach",
  bio: "Teacher biography",
  experienceYears: 6,
  nativeLanguage: "fa",
  teachingLanguage: "en",
};

const slots = {
  teacherProfileId:
    "teacher-profile-1",
  timezone: "Asia/Tehran",
  fromDate: "2026-08-18",
  toDate: "2026-09-17",
  slots: [
    {
      date: "2026-08-20",
      startMinute: 540,
      endMinute: 555,
      startAt:
        "2026-08-20T05:30:00.000Z",
      endAt:
        "2026-08-20T05:45:00.000Z",
    },
  ],
};

const session = {
  id: "session-1",
  teacherProfileId:
    "teacher-profile-1",
  startAt:
    "2026-08-20T05:30:00.000Z",
  endAt:
    "2026-08-20T05:45:00.000Z",
  status: "SCHEDULED",
};

function jsonResponse(
  body: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("student booking API client", () => {
  it("parses only the explicit public teacher allowlist", () => {
    expect(
      parsePublicTeacherDetailResponse({
        teacher,
      }),
    ).toEqual({ teacher });

    expect(
      parsePublicTeacherDetailResponse({
        teacher: {
          ...teacher,
          applicationStatus:
            "APPROVED",
        },
      }),
    ).toBeNull();
  });

  it("validates authoritative Tehran slots without projecting new slots", () => {
    expect(
      parseBookableSlotsResponse(
        slots,
      ),
    ).toEqual(slots);

    expect(
      parseBookableSlotsResponse({
        ...slots,
        timezone:
          "Europe/Helsinki",
      }),
    ).toBeNull();

    expect(
      parseBookableSlotsResponse({
        ...slots,
        slots: [
          {
            ...slots.slots[0],
            endMinute: 570,
          },
        ],
      }),
    ).toBeNull();
  });

  it("accepts only a persisted scheduled booking confirmation allowlist", () => {
    expect(
      parseCreatedBookingResponse({
        session,
      }),
    ).toEqual({ session });

    expect(
      parseCreatedBookingResponse({
        session: {
          ...session,
          studentUserId:
            "student-user-1",
        },
      }),
    ).toBeNull();
  });

  it("generates a secure booking-attempt key that satisfies the Track A transport shape", () => {
    const key =
      generateBookingIdempotencyKey();

    expect(key).toMatch(
      /^booking-[0-9a-f-]{36}$/i,
    );
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(key).not.toMatch(/\s/);
  });

  it("uses encoded teacher paths and preserves the requested authoritative range", () => {
    expect(
      buildTeacherDetailUrl(
        "teacher/profile",
      ),
    ).toBe(
      "/api/teachers/teacher%2Fprofile",
    );

    expect(
      buildTeacherSlotsUrl(
        "teacher-profile-1",
        {
          fromDate:
            "2026-08-18",
          toDate:
            "2026-09-17",
        },
      ),
    ).toBe(
      "/api/teachers/teacher-profile-1/slots?fromDate=2026-08-18&toDate=2026-09-17",
    );
  });

  it("loads profile and slots through the public Track A routes", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ teacher }),
      )
      .mockResolvedValueOnce(
        jsonResponse(slots),
      );

    await expect(
      getPublicTeacherDetail(
        "teacher-profile-1",
      ),
    ).resolves.toEqual(teacher);

    await expect(
      getBookableSlots(
        "teacher-profile-1",
        {
          fromDate:
            "2026-08-18",
          toDate:
            "2026-09-17",
        },
      ),
    ).resolves.toEqual(slots);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls[0]?.[0],
    ).toBe(
      "/api/teachers/teacher-profile-1",
    );
    expect(
      fetchMock.mock.calls[1]?.[0],
    ).toBe(
      "/api/teachers/teacher-profile-1/slots?fromDate=2026-08-18&toDate=2026-09-17",
    );
  });

  it("posts the exact authoritative startAt and stable idempotency key without an Origin override", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ session }),
      );

    const attempt = {
      teacherProfileId:
        "teacher-profile-1",
      startAt:
        "2026-08-20T05:30:00.000Z",
      idempotencyKey:
        "booking-request-00000001",
    };

    await expect(
      createStudentBooking(attempt),
    ).resolves.toEqual(session);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] =
      fetchMock.mock.calls[0] ?? [];

    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(attempt),
    });

    expect(
      new Headers(
        init?.headers,
      ).has("Origin"),
    ).toBe(false);
  });

  it("surfaces stable Track A booking errors and rejects mismatched success", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              "SLOT_UNAVAILABLE",
          },
          409,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          session: {
            ...session,
            teacherProfileId:
              "different-teacher",
          },
        }),
      );

    const attempt = {
      teacherProfileId:
        "teacher-profile-1",
      startAt:
        "2026-08-20T05:30:00.000Z",
      idempotencyKey:
        "booking-request-00000001",
    };

    await expect(
      createStudentBooking(attempt),
    ).rejects.toMatchObject({
      code: "SLOT_UNAVAILABLE",
      status: 409,
    });

    await expect(
      createStudentBooking(attempt),
    ).rejects.toThrow(
      "did not confirm the requested durable session",
    );
  });
});

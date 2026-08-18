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

    getPublicTeacherDetail:
      vi.fn(),

    getBookableSlotsForTeacher:
      vi.fn(),

    createSpeakingSession:
      vi.fn(),

    listSpeakingSessions:
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
  "@/lib/services/teacher-discovery.service",
  () => ({
    getPublicTeacherDetail:
      mocks.getPublicTeacherDetail,
  }),
);

vi.mock(
  "@/lib/services/bookable-slots.service",
  () => ({
    getBookableSlotsForTeacher:
      mocks.getBookableSlotsForTeacher,
  }),
);

vi.mock(
  "@/lib/services/booking.service",
  () => ({
    createSpeakingSession:
      mocks.createSpeakingSession,
  }),
);

vi.mock(
  "@/lib/services/speaking-session-read.service",
  () => ({
    listSpeakingSessions:
      mocks.listSpeakingSessions,
  }),
);

import {
  BookableSlotsRangeError,
  BookableTeacherNotFoundError,
  BookingConflictError,
  BookingIdempotencyConflictError,
  BookingLimitExceededError,
  BookingSelfBookingError,
  BookingSlotUnavailableError,
  BookingStudentNotEligibleError,
} from "@/lib/errors/booking-errors";

import {
  bookingMutationErrorResponse,
  bookingPrivateJson,
  bookingPublicJson,
  serializeCreatedBookingSession,
} from "@/lib/errors/booking-http";

import {
  GET as getTeacherDetail,
  dynamic as detailDynamic,
  runtime as detailRuntime,
} from "@/app/api/teachers/[teacherProfileId]/route";

import {
  GET as getSlots,
  dynamic as slotsDynamic,
  runtime as slotsRuntime,
} from "@/app/api/teachers/[teacherProfileId]/slots/route";

import {
  POST as createBooking,
} from "@/app/api/sessions/route";

const PUBLIC_DETAIL = {
  teacherProfileId:
    "teacher-profile-1",

  name:
    "Teacher One",

  image:
    null,

  headline:
    "Speaking coach",

  bio:
    "Teacher biography",

  experienceYears:
    6,

  nativeLanguage:
    "fa",

  teachingLanguage:
    "en",
};

const SLOT_START =
  new Date(
    "2026-08-20T05:30:00.000Z",
  );

const SLOT_END =
  new Date(
    "2026-08-20T05:45:00.000Z",
  );

const SLOT_RESULT = {
  teacherProfileId:
    "teacher-profile-1",

  timezone:
    "Asia/Tehran",

  fromDate:
    "2026-08-20",

  toDate:
    "2026-08-20",

  slots: [
    {
      date:
        "2026-08-20",

      startMinute:
        540,

      endMinute:
        555,

      startAt:
        SLOT_START,

      endAt:
        SLOT_END,
    },
  ],
};

const CREATED_SESSION = {
  id:
    "session-1",

  teacherProfileId:
    "teacher-profile-1",

  studentUserId:
    "student-user-1",

  startAt:
    SLOT_START,

  endAt:
    SLOT_END,

  status:
    "SCHEDULED" as const,

  createdAt:
    new Date(
      "2026-08-18T10:00:00.000Z",
    ),

  updatedAt:
    new Date(
      "2026-08-18T10:00:00.000Z",
    ),
};

const SESSION = {
  user: {
    id:
      "student-user-1",
  },
};

function bookingRequest(
  body:
    string,
): Request {
  return new Request(
    "http://localhost:3000/api/sessions",
    {
      method:
        "POST",

      headers: {
        origin:
          "http://localhost:3000",

        "content-type":
          "application/json",
      },

      body,
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
    .getPublicTeacherDetail
    .mockResolvedValue(
      PUBLIC_DETAIL,
    );

  mocks
    .getBookableSlotsForTeacher
    .mockResolvedValue(
      SLOT_RESULT,
    );

  mocks
    .createSpeakingSession
    .mockResolvedValue(
      CREATED_SESSION,
    );
});

describe(
  "B4 HTTP serializers",
  () => {
    it(
      "uses no-store for public volatile booking reads",
      () => {
        const response =
          bookingPublicJson({
            ok:
              true,
          });

        expect(
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "no-store",
        );
      },
    );

    it(
      "uses private no-store for booking mutations",
      () => {
        const response =
          bookingPrivateJson({
            ok:
              true,
          });

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
      "does not expose student identity or the idempotency key in booking success",
      () => {
        const serialized =
          serializeCreatedBookingSession(
            CREATED_SESSION,
          );

        expect(
          serialized,
        ).toEqual({
          id:
            "session-1",

          teacherProfileId:
            "teacher-profile-1",

          startAt:
            "2026-08-20T05:30:00.000Z",

          endAt:
            "2026-08-20T05:45:00.000Z",

          status:
            "SCHEDULED",
        });

        expect(
          serialized,
        ).not.toHaveProperty(
          "studentUserId",
        );

        expect(
          serialized,
        ).not.toHaveProperty(
          "bookingIdempotencyKey",
        );
      },
    );
  },
);

describe(
  "public teacher detail route",
  () => {
    it(
      "is Node.js and dynamic",
      () => {
        expect(
          detailRuntime,
        ).toBe(
          "nodejs",
        );

        expect(
          detailDynamic,
        ).toBe(
          "force-dynamic",
        );
      },
    );

    it(
      "returns one allowlisted discoverable teacher without authentication",
      async () => {
        const response =
          await getTeacherDetail(
            new Request(
              "http://localhost:3000/api/teachers/teacher-profile-1",
            ),
            {
              params:
                Promise.resolve({
                  teacherProfileId:
                    "teacher-profile-1",
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
          "no-store",
        );

        expect(
          mocks.getApiSession,
        ).not.toHaveBeenCalled();

        expect(
          mocks
            .getPublicTeacherDetail,
        ).toHaveBeenCalledWith(
          "teacher-profile-1",
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          teacher:
            PUBLIC_DETAIL,
        });
      },
    );

    it(
      "makes missing and non-public teachers the same public 404",
      async () => {
        mocks
          .getPublicTeacherDetail
          .mockRejectedValueOnce(
            new BookableTeacherNotFoundError(),
          );

        const response =
          await getTeacherDetail(
            new Request(
              "http://localhost:3000/api/teachers/teacher-profile-1",
            ),
            {
              params:
                Promise.resolve({
                  teacherProfileId:
                    "teacher-profile-1",
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
            "TEACHER_NOT_FOUND",
        });
      },
    );
  },
);

describe(
  "authoritative bookable slots route",
  () => {
    it(
      "is Node.js and dynamic",
      () => {
        expect(
          slotsRuntime,
        ).toBe(
          "nodejs",
        );

        expect(
          slotsDynamic,
        ).toBe(
          "force-dynamic",
        );
      },
    );

    it(
      "returns server-projected Tehran slots with ISO instants",
      async () => {
        const response =
          await getSlots(
            new Request(
              "http://localhost:3000/api/teachers/teacher-profile-1/slots" +
                "?fromDate=2026-08-20" +
                "&toDate=2026-08-20",
            ),
            {
              params:
                Promise.resolve({
                  teacherProfileId:
                    "teacher-profile-1",
                }),
            },
          );

        expect(
          response.status,
        ).toBe(
          200,
        );

        expect(
          mocks
            .getBookableSlotsForTeacher,
        ).toHaveBeenCalledWith(
          "teacher-profile-1",
          {
            fromDate:
              "2026-08-20",

            toDate:
              "2026-08-20",
          },
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          teacherProfileId:
            "teacher-profile-1",

          timezone:
            "Asia/Tehran",

          fromDate:
            "2026-08-20",

          toDate:
            "2026-08-20",

          slots: [
            {
              date:
                "2026-08-20",

              startMinute:
                540,

              endMinute:
                555,

              startAt:
                "2026-08-20T05:30:00.000Z",

              endAt:
                "2026-08-20T05:45:00.000Z",
            },
          ],
        });
      },
    );

    it.each([
      [
        "missing fromDate",
        "?toDate=2026-08-20",
      ],
      [
        "missing toDate",
        "?fromDate=2026-08-20",
      ],
      [
        "duplicate parameter",
        "?fromDate=2026-08-20&fromDate=2026-08-21&toDate=2026-08-20",
      ],
      [
        "unknown parameter",
        "?fromDate=2026-08-20&toDate=2026-08-20&status=APPROVED",
      ],
    ])(
      "rejects %s before service access",
      async (
        _label,
        query,
      ) => {
        const response =
          await getSlots(
            new Request(
              "http://localhost:3000/api/teachers/teacher-profile-1/slots" +
                query,
            ),
            {
              params:
                Promise.resolve({
                  teacherProfileId:
                    "teacher-profile-1",
                }),
            },
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
            .getBookableSlotsForTeacher,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "maps bounded-range failures without parsing messages",
      async () => {
        mocks
          .getBookableSlotsForTeacher
          .mockRejectedValueOnce(
            new BookableSlotsRangeError(
              "RANGE_TOO_LARGE",
            ),
          );

        const response =
          await getSlots(
            new Request(
              "http://localhost:3000/api/teachers/teacher-profile-1/slots" +
                "?fromDate=2026-08-20" +
                "&toDate=2026-09-30",
            ),
            {
              params:
                Promise.resolve({
                  teacherProfileId:
                    "teacher-profile-1",
                }),
            },
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
      "fails closed when the teacher stopped being public",
      async () => {
        mocks
          .getBookableSlotsForTeacher
          .mockRejectedValueOnce(
            new BookableTeacherNotFoundError(),
          );

        const response =
          await getSlots(
            new Request(
              "http://localhost:3000/api/teachers/teacher-profile-1/slots" +
                "?fromDate=2026-08-20" +
                "&toDate=2026-08-20",
            ),
            {
              params:
                Promise.resolve({
                  teacherProfileId:
                    "teacher-profile-1",
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
            "TEACHER_NOT_FOUND",
        });
      },
    );
  },
);

describe(
  "student booking creation route",
  () => {
    it(
      "checks trusted origin before authentication",
      async () => {
        mocks
          .hasTrustedRequestOrigin
          .mockReturnValueOnce(
            false,
          );

        const response =
          await createBooking(
            bookingRequest(
              JSON.stringify({
                teacherProfileId:
                  "teacher-profile-1",

                startAt:
                  "2026-08-20T05:30:00.000Z",

                idempotencyKey:
                  "booking-request-00000001",
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
            .createSpeakingSession,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "requires an authenticated active session",
      async () => {
        mocks
          .getApiSession
          .mockResolvedValueOnce(
            null,
          );

        const response =
          await createBooking(
            bookingRequest(
              JSON.stringify({
                teacherProfileId:
                  "teacher-profile-1",

                startAt:
                  "2026-08-20T05:30:00.000Z",

                idempotencyKey:
                  "booking-request-00000001",
              }),
            ),
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
      },
    );

    it(
      "rejects malformed JSON before service access",
      async () => {
        const response =
          await createBooking(
            bookingRequest(
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
            .createSpeakingSession,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "reuses the canonical strict booking input schema",
      async () => {
        const response =
          await createBooking(
            bookingRequest(
              JSON.stringify({
                teacherProfileId:
                  "teacher-profile-1",

                startAt:
                  "2026-08-20T05:31:00.000Z",

                idempotencyKey:
                  "booking-request-00000001",
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
            .createSpeakingSession,
        ).not.toHaveBeenCalled();
      },
    );

    it(
      "returns persisted authoritative session state only after service success",
      async () => {
        const input = {
          teacherProfileId:
            "teacher-profile-1",

          startAt:
            "2026-08-20T05:30:00.000Z",

          idempotencyKey:
            "booking-request-00000001",
        };

        const response =
          await createBooking(
            bookingRequest(
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
          response.headers.get(
            "cache-control",
          ),
        ).toBe(
          "private, no-store",
        );

        expect(
          mocks
            .createSpeakingSession,
        ).toHaveBeenCalledWith(
          "student-user-1",
          input,
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          session: {
            id:
              "session-1",

            teacherProfileId:
              "teacher-profile-1",

            startAt:
              "2026-08-20T05:30:00.000Z",

            endAt:
              "2026-08-20T05:45:00.000Z",

            status:
              "SCHEDULED",
          },
        });
      },
    );

    it.each([
      [
        new BookingStudentNotEligibleError(),
        403,
        "BOOKING_STUDENT_NOT_ELIGIBLE",
      ],

      [
        new BookingSelfBookingError(),
        403,
        "SELF_BOOKING_FORBIDDEN",
      ],

      [
        new BookableTeacherNotFoundError(),
        404,
        "TEACHER_NOT_FOUND",
      ],

      [
        new BookingSlotUnavailableError(),
        409,
        "SLOT_UNAVAILABLE",
      ],

      [
        new BookingLimitExceededError(),
        409,
        "BOOKING_LIMIT_EXCEEDED",
      ],

      [
        new BookingIdempotencyConflictError(),
        409,
        "IDEMPOTENCY_CONFLICT",
      ],

      [
        new BookingConflictError(),
        409,
        "BOOKING_CONFLICT",
      ],
    ])(
      "maps %s to HTTP %s / %s",
      async (
        error,
        expectedStatus,
        expectedCode,
      ) => {
        const response =
          bookingMutationErrorResponse(
            error,
          );

        expect(
          response.status,
        ).toBe(
          expectedStatus,
        );

        await expect(
          response.json(),
        ).resolves.toEqual({
          error:
            expectedCode,
        });
      },
    );

    it(
      "sanitizes unexpected booking failures",
      async () => {
        const response =
          bookingMutationErrorResponse(
            new Error(
              "postgresql://secret-user:secret-password@internal/database",
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
          "secret-password",
        );
      },
    );
  },
);

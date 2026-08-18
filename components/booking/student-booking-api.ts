import {
  PROFILE_LANGUAGE_CODES,
  type ProfileLanguageCode,
} from "@/lib/domain/profile";
import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";
import {
  getBookingWindow,
  instantToIranDateKey,
  instantToIranMinuteOfDay,
} from "@/lib/time/iran-booking-time";

export type PublicTeacherDetail = {
  teacherProfileId: string;
  name: string;
  image: string | null;
  headline: string | null;
  bio: string | null;
  experienceYears: number | null;
  nativeLanguage: ProfileLanguageCode;
  teachingLanguage: ProfileLanguageCode;
};

export type PublicTeacherDetailResponse = {
  teacher: PublicTeacherDetail;
};

export type BookableSlot = {
  date: string;
  startMinute: number;
  endMinute: number;
  startAt: string;
  endAt: string;
};

export type BookableSlotsResponse = {
  teacherProfileId: string;
  timezone: typeof BOOKING_OPERATIONAL_TIMEZONE;
  fromDate: string;
  toDate: string;
  slots: BookableSlot[];
};

export type BookingAttempt = {
  teacherProfileId: string;
  startAt: string;
  idempotencyKey: string;
};

export type CreatedBookingSession = {
  id: string;
  teacherProfileId: string;
  startAt: string;
  endAt: string;
  status: "SCHEDULED";
};

export type CreatedBookingResponse = {
  session: CreatedBookingSession;
};

export type BookingReadErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_DATE_RANGE"
  | "RANGE_TOO_LARGE"
  | "TEACHER_NOT_FOUND"
  | "INTERNAL_SERVER_ERROR";

export type BookingMutationErrorCode =
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "UNTRUSTED_ORIGIN"
  | "BOOKING_STUDENT_NOT_ELIGIBLE"
  | "SELF_BOOKING_FORBIDDEN"
  | "TEACHER_NOT_FOUND"
  | "SLOT_UNAVAILABLE"
  | "BOOKING_LIMIT_EXCEEDED"
  | "IDEMPOTENCY_CONFLICT"
  | "BOOKING_CONFLICT"
  | "INTERNAL_SERVER_ERROR";

export class BookingApiError extends Error {
  readonly code:
    BookingReadErrorCode |
    BookingMutationErrorCode;

  readonly status: number;

  constructor(
    code:
      BookingReadErrorCode |
      BookingMutationErrorCode,
    status: number,
  ) {
    super(code);
    this.name = "BookingApiError";
    this.code = code;
    this.status = status;
  }
}

export type BookingBrowseRange = {
  fromDate: string;
  toDate: string;
};

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const READ_ERROR_CODES = new Set<BookingReadErrorCode>([
  "INVALID_REQUEST",
  "INVALID_DATE_RANGE",
  "RANGE_TOO_LARGE",
  "TEACHER_NOT_FOUND",
  "INTERNAL_SERVER_ERROR",
]);

const MUTATION_ERROR_CODES = new Set<BookingMutationErrorCode>([
  "INVALID_JSON",
  "INVALID_REQUEST",
  "UNAUTHORIZED",
  "UNTRUSTED_ORIGIN",
  "BOOKING_STUDENT_NOT_ELIGIBLE",
  "SELF_BOOKING_FORBIDDEN",
  "TEACHER_NOT_FOUND",
  "SLOT_UNAVAILABLE",
  "BOOKING_LIMIT_EXCEEDED",
  "IDEMPOTENCY_CONFLICT",
  "BOOKING_CONFLICT",
  "INTERNAL_SERVER_ERROR",
]);

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return (
    actual.length === expected.length &&
    actual.every(
      (key, index) =>
        key === expected[index],
    )
  );
}

function isCanonicalIdentifier(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    value === value.trim() &&
    !/\s/.test(value)
  );
}

function isNullableString(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    typeof value === "string"
  );
}

function isNullableNonNegativeInteger(
  value: unknown,
): value is number | null {
  return (
    value === null ||
    (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0
    )
  );
}

function isProfileLanguageCode(
  value: unknown,
): value is ProfileLanguageCode {
  return (
    typeof value === "string" &&
    PROFILE_LANGUAGE_CODES.some(
      (code) => code === value,
    )
  );
}

function isDateKey(
  value: unknown,
): value is string {
  if (
    typeof value !== "string" ||
    !DATE_KEY_PATTERN.test(value)
  ) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const candidate = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function isIsoInstant(
  value: unknown,
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const instant = new Date(value);

  return (
    !Number.isNaN(instant.getTime()) &&
    instant.toISOString() === value
  );
}

function isQuarterHourMinute(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 1440 &&
    value % 15 === 0
  );
}

export function parsePublicTeacherDetailResponse(
  value: unknown,
): PublicTeacherDetailResponse | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["teacher"]) ||
    !isRecord(value.teacher)
  ) {
    return null;
  }

  const teacher = value.teacher;

  if (
    !hasExactKeys(teacher, [
      "teacherProfileId",
      "name",
      "image",
      "headline",
      "bio",
      "experienceYears",
      "nativeLanguage",
      "teachingLanguage",
    ]) ||
    !isCanonicalIdentifier(
      teacher.teacherProfileId,
    ) ||
    typeof teacher.name !== "string" ||
    !isNullableString(teacher.image) ||
    !isNullableString(teacher.headline) ||
    !isNullableString(teacher.bio) ||
    !isNullableNonNegativeInteger(
      teacher.experienceYears,
    ) ||
    !isProfileLanguageCode(
      teacher.nativeLanguage,
    ) ||
    !isProfileLanguageCode(
      teacher.teachingLanguage,
    )
  ) {
    return null;
  }

  return {
    teacher: {
      teacherProfileId:
        teacher.teacherProfileId,
      name: teacher.name,
      image: teacher.image,
      headline: teacher.headline,
      bio: teacher.bio,
      experienceYears:
        teacher.experienceYears,
      nativeLanguage:
        teacher.nativeLanguage,
      teachingLanguage:
        teacher.teachingLanguage,
    },
  };
}

export function parseBookableSlotsResponse(
  value: unknown,
): BookableSlotsResponse | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "teacherProfileId",
      "timezone",
      "fromDate",
      "toDate",
      "slots",
    ]) ||
    !isCanonicalIdentifier(
      value.teacherProfileId,
    ) ||
    value.timezone !==
      BOOKING_OPERATIONAL_TIMEZONE ||
    !isDateKey(value.fromDate) ||
    !isDateKey(value.toDate) ||
    !Array.isArray(value.slots)
  ) {
    return null;
  }

  const slots: BookableSlot[] = [];
  const seenStartAt = new Set<string>();

  for (const candidate of value.slots) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, [
        "date",
        "startMinute",
        "endMinute",
        "startAt",
        "endAt",
      ]) ||
      !isDateKey(candidate.date) ||
      !isQuarterHourMinute(
        candidate.startMinute,
      ) ||
      !isQuarterHourMinute(
        candidate.endMinute,
      ) ||
      candidate.endMinute -
          candidate.startMinute !==
        15 ||
      !isIsoInstant(candidate.startAt) ||
      !isIsoInstant(candidate.endAt) ||
      instantToIranDateKey(
        new Date(candidate.startAt),
      ) !== candidate.date ||
      instantToIranMinuteOfDay(
        new Date(candidate.startAt),
      ) !== candidate.startMinute ||
      new Date(candidate.endAt).getTime() -
          new Date(candidate.startAt).getTime() !==
        15 * 60_000 ||
      seenStartAt.has(candidate.startAt)
    ) {
      return null;
    }

    seenStartAt.add(candidate.startAt);
    slots.push({
      date: candidate.date,
      startMinute: candidate.startMinute,
      endMinute: candidate.endMinute,
      startAt: candidate.startAt,
      endAt: candidate.endAt,
    });
  }

  return {
    teacherProfileId:
      value.teacherProfileId,
    timezone: value.timezone,
    fromDate: value.fromDate,
    toDate: value.toDate,
    slots,
  };
}

export function parseCreatedBookingResponse(
  value: unknown,
): CreatedBookingResponse | null {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["session"]) ||
    !isRecord(value.session)
  ) {
    return null;
  }

  const session = value.session;

  if (
    !hasExactKeys(session, [
      "id",
      "teacherProfileId",
      "startAt",
      "endAt",
      "status",
    ]) ||
    !isCanonicalIdentifier(session.id) ||
    !isCanonicalIdentifier(
      session.teacherProfileId,
    ) ||
    !isIsoInstant(session.startAt) ||
    !isIsoInstant(session.endAt) ||
    session.status !== "SCHEDULED" ||
    new Date(session.endAt).getTime() -
        new Date(session.startAt).getTime() !==
      15 * 60_000
  ) {
    return null;
  }

  return {
    session: {
      id: session.id,
      teacherProfileId:
        session.teacherProfileId,
      startAt: session.startAt,
      endAt: session.endAt,
      status: session.status,
    },
  };
}

function parseErrorCode(
  value: unknown,
  allowed: Set<string>,
): string | null {
  if (
    !isRecord(value) ||
    typeof value.error !== "string" ||
    !allowed.has(value.error)
  ) {
    return null;
  }

  return value.error;
}

async function readUnknownJson(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function teacherBaseUrl(
  teacherProfileId: string,
): string {
  return `/api/teachers/${encodeURIComponent(
    teacherProfileId,
  )}`;
}

export function getBookingBrowseRange(
  now: Date,
): BookingBrowseRange {
  const window = getBookingWindow(now);

  return {
    fromDate: instantToIranDateKey(now),
    toDate: instantToIranDateKey(
      window.latestStartAt,
    ),
  };
}

export function buildTeacherDetailUrl(
  teacherProfileId: string,
): string {
  return teacherBaseUrl(teacherProfileId);
}

export function buildTeacherSlotsUrl(
  teacherProfileId: string,
  range: BookingBrowseRange,
): string {
  const params = new URLSearchParams({
    fromDate: range.fromDate,
    toDate: range.toDate,
  });

  return `${teacherBaseUrl(
    teacherProfileId,
  )}/slots?${params.toString()}`;
}

export function generateBookingIdempotencyKey(): string {
  const randomUuid = globalThis.crypto?.randomUUID;

  if (typeof randomUuid !== "function") {
    throw new Error(
      "Secure booking idempotency generation is unavailable.",
    );
  }

  return `booking-${randomUuid.call(globalThis.crypto)}`;
}

export async function getPublicTeacherDetail(
  teacherProfileId: string,
  signal?: AbortSignal,
): Promise<PublicTeacherDetail> {
  const response = await fetch(
    buildTeacherDetailUrl(teacherProfileId),
    {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = await readUnknownJson(response);

  if (!response.ok) {
    const code = parseErrorCode(
      payload,
      READ_ERROR_CODES,
    );

    throw new BookingApiError(
      (code ?? "INTERNAL_SERVER_ERROR") as BookingReadErrorCode,
      response.status,
    );
  }

  const parsed =
    parsePublicTeacherDetailResponse(
      payload,
    );

  if (!parsed) {
    throw new Error(
      "Teacher detail response violated the public contract.",
    );
  }

  if (
    parsed.teacher.teacherProfileId !==
    teacherProfileId
  ) {
    throw new Error(
      "Teacher detail identity did not match the requested profile.",
    );
  }

  return parsed.teacher;
}

export async function getBookableSlots(
  teacherProfileId: string,
  range: BookingBrowseRange,
  signal?: AbortSignal,
): Promise<BookableSlotsResponse> {
  const response = await fetch(
    buildTeacherSlotsUrl(
      teacherProfileId,
      range,
    ),
    {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = await readUnknownJson(response);

  if (!response.ok) {
    const code = parseErrorCode(
      payload,
      READ_ERROR_CODES,
    );

    throw new BookingApiError(
      (code ?? "INTERNAL_SERVER_ERROR") as BookingReadErrorCode,
      response.status,
    );
  }

  const parsed = parseBookableSlotsResponse(
    payload,
  );

  if (
    !parsed ||
    parsed.teacherProfileId !==
      teacherProfileId ||
    parsed.fromDate !== range.fromDate ||
    parsed.toDate !== range.toDate
  ) {
    throw new Error(
      "Bookable-slots response violated the authoritative contract.",
    );
  }

  return parsed;
}

export async function createStudentBooking(
  attempt: BookingAttempt,
): Promise<CreatedBookingSession> {
  let response: Response;

  try {
    response = await fetch(
      "/api/sessions",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          teacherProfileId:
            attempt.teacherProfileId,
          startAt: attempt.startAt,
          idempotencyKey:
            attempt.idempotencyKey,
        }),
      },
    );
  } catch (error) {
    throw error;
  }

  const payload = await readUnknownJson(response);

  if (!response.ok) {
    const code = parseErrorCode(
      payload,
      MUTATION_ERROR_CODES,
    );

    throw new BookingApiError(
      (code ?? "INTERNAL_SERVER_ERROR") as BookingMutationErrorCode,
      response.status,
    );
  }

  const parsed = parseCreatedBookingResponse(
    payload,
  );

  if (
    !parsed ||
    parsed.session.teacherProfileId !==
      attempt.teacherProfileId ||
    parsed.session.startAt !==
      attempt.startAt
  ) {
    throw new Error(
      "Booking success response did not confirm the requested durable session.",
    );
  }

  return parsed.session;
}

export function isBookingApiError(
  error: unknown,
): error is BookingApiError {
  return error instanceof BookingApiError;
}

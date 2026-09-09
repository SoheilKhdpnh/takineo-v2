import {
  AVAILABILITY_EXCEPTION_TYPES,
  BOOKING_WEEKDAYS,
  isBookingDateKey,
  isValidMinuteInterval,
  type AvailabilityExceptionType,
  type BookingWeekday,
} from "@/lib/domain/booking";
import {
  getBookingWindow,
  instantToIranDateKey,
} from "@/lib/time/iran-booking-time";

export type TeacherAvailabilityErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_JSON"
  | "INVALID_DATE_RANGE"
  | "RANGE_TOO_LARGE"
  | "UNAUTHORIZED"
  | "UNTRUSTED_ORIGIN"
  | "FORBIDDEN_PROFILE_TYPE"
  | "PROFILE_NOT_FOUND"
  | "TEACHER_AVAILABILITY_EXCEPTION_NOT_FOUND"
  | "TEACHER_AVAILABILITY_STATE_CONFLICT"
  | "TEACHER_AVAILABILITY_CONFLICT"
  | "INTERNAL_SERVER_ERROR";

export type TeacherAvailabilityReadRange = {
  fromDate: string;
  toDate: string;
};

export type TeacherAvailabilityRule = {
  id: string;
  teacherProfileId: string;
  weekday: BookingWeekday;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAvailabilityException = {
  id: string;
  teacherProfileId: string;
  date: string;
  startMinute: number;
  endMinute: number;
  type: AvailabilityExceptionType;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherAvailabilitySnapshot = {
  rules: TeacherAvailabilityRule[];
  exceptions: TeacherAvailabilityException[];
};

export type TeacherAvailabilityRuleInput = {
  weekday: BookingWeekday;
  startMinute: number;
  endMinute: number;
  isActive: boolean;
};

export type TeacherAvailabilityExceptionInput = {
  date: string;
  startMinute: number;
  endMinute: number;
  type: AvailabilityExceptionType;
  note?: string;
};

export class TeacherAvailabilityApiError extends Error {
  readonly code: TeacherAvailabilityErrorCode | null;
  readonly status: number;

  constructor(
    status: number,
    code: TeacherAvailabilityErrorCode | null,
  ) {
    super(code ?? "TEACHER_AVAILABILITY_REQUEST_FAILED");
    this.name = "TeacherAvailabilityApiError";
    this.status = status;
    this.code = code;
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isCanonicalIdentifier(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value === value.trim()
  );
}

function isIsoInstant(
  value: unknown,
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = new Date(value);

  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString() === value
  );
}

function isBookingWeekday(
  value: unknown,
): value is BookingWeekday {
  return (
    typeof value === "string" &&
    BOOKING_WEEKDAYS.includes(
      value as BookingWeekday,
    )
  );
}

function isAvailabilityExceptionType(
  value: unknown,
): value is AvailabilityExceptionType {
  return (
    typeof value === "string" &&
    AVAILABILITY_EXCEPTION_TYPES.includes(
      value as AvailabilityExceptionType,
    )
  );
}

function isAvailabilityRule(
  value: unknown,
): value is TeacherAvailabilityRule {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isCanonicalIdentifier(value.id) &&
    isCanonicalIdentifier(
      value.teacherProfileId,
    ) &&
    isBookingWeekday(value.weekday) &&
    isValidMinuteInterval({
      startMinute: value.startMinute as number,
      endMinute: value.endMinute as number,
    }) &&
    typeof value.isActive === "boolean" &&
    isIsoInstant(value.createdAt) &&
    isIsoInstant(value.updatedAt)
  );
}

function isAvailabilityException(
  value: unknown,
): value is TeacherAvailabilityException {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isCanonicalIdentifier(value.id) &&
    isCanonicalIdentifier(
      value.teacherProfileId,
    ) &&
    typeof value.date === "string" &&
    isBookingDateKey(value.date) &&
    isValidMinuteInterval({
      startMinute: value.startMinute as number,
      endMinute: value.endMinute as number,
    }) &&
    isAvailabilityExceptionType(
      value.type,
    ) &&
    (
      value.note === null ||
      typeof value.note === "string"
    ) &&
    isIsoInstant(value.createdAt) &&
    isIsoInstant(value.updatedAt)
  );
}

const ERROR_CODES = new Set<TeacherAvailabilityErrorCode>([
  "INVALID_REQUEST",
  "INVALID_JSON",
  "INVALID_DATE_RANGE",
  "RANGE_TOO_LARGE",
  "UNAUTHORIZED",
  "UNTRUSTED_ORIGIN",
  "FORBIDDEN_PROFILE_TYPE",
  "PROFILE_NOT_FOUND",
  "TEACHER_AVAILABILITY_EXCEPTION_NOT_FOUND",
  "TEACHER_AVAILABILITY_STATE_CONFLICT",
  "TEACHER_AVAILABILITY_CONFLICT",
  "INTERNAL_SERVER_ERROR",
]);

export function parseTeacherAvailabilityErrorCode(
  value: unknown,
): TeacherAvailabilityErrorCode | null {
  if (!isRecord(value)) {
    return null;
  }

  const code = value.error;

  if (
    typeof code !== "string" ||
    !ERROR_CODES.has(
      code as TeacherAvailabilityErrorCode,
    )
  ) {
    return null;
  }

  return code as TeacherAvailabilityErrorCode;
}

export function parseTeacherAvailabilitySnapshotResponse(
  value: unknown,
): TeacherAvailabilitySnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  const availability = value.availability;

  if (!isRecord(availability)) {
    return null;
  }

  const rules = availability.rules;
  const exceptions = availability.exceptions;

  if (
    !Array.isArray(rules) ||
    !rules.every(isAvailabilityRule) ||
    !Array.isArray(exceptions) ||
    !exceptions.every(
      isAvailabilityException,
    )
  ) {
    return null;
  }

  const ruleIds = new Set<string>();

  for (const rule of rules) {
    if (ruleIds.has(rule.id)) {
      return null;
    }

    ruleIds.add(rule.id);
  }

  const exceptionIds = new Set<string>();

  for (const exception of exceptions) {
    if (exceptionIds.has(exception.id)) {
      return null;
    }

    exceptionIds.add(exception.id);
  }

  return {
    rules,
    exceptions,
  };
}

export function parseTeacherAvailabilityRulesResponse(
  value: unknown,
): TeacherAvailabilityRule[] | null {
  if (!isRecord(value)) {
    return null;
  }

  const rules = value.rules;

  if (
    !Array.isArray(rules) ||
    !rules.every(isAvailabilityRule)
  ) {
    return null;
  }

  const ids = new Set<string>();

  for (const rule of rules) {
    if (ids.has(rule.id)) {
      return null;
    }

    ids.add(rule.id);
  }

  return rules;
}

export function parseTeacherAvailabilityExceptionResponse(
  value: unknown,
): TeacherAvailabilityException | null {
  if (!isRecord(value)) {
    return null;
  }

  return isAvailabilityException(
    value.exception,
  )
    ? value.exception
    : null;
}

export function parseTeacherAvailabilityDeleteResponse(
  value: unknown,
): boolean {
  return (
    isRecord(value) &&
    value.deleted === true
  );
}

export function getTeacherAvailabilityReadRange(
  now: Date,
): TeacherAvailabilityReadRange {
  const bookingWindow =
    getBookingWindow(now);

  return {
    fromDate:
      instantToIranDateKey(now),
    toDate:
      instantToIranDateKey(
        bookingWindow.latestStartAt,
      ),
  };
}

export function buildTeacherAvailabilityReadUrl(
  range: TeacherAvailabilityReadRange,
): string {
  const params =
    new URLSearchParams({
      fromDate: range.fromDate,
      toDate: range.toDate,
    });

  return (
    "/api/profile/teacher/availability?" +
    params.toString()
  );
}

async function readJson(
  response: Response,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function assertOk(
  response: Response,
): Promise<unknown> {
  const body = await readJson(response);

  if (!response.ok) {
    throw new TeacherAvailabilityApiError(
      response.status,
      parseTeacherAvailabilityErrorCode(
        body,
      ),
    );
  }

  return body;
}

export async function getTeacherAvailability(
  range: TeacherAvailabilityReadRange,
  signal?: AbortSignal,
): Promise<TeacherAvailabilitySnapshot> {
  const response = await fetch(
    buildTeacherAvailabilityReadUrl(
      range,
    ),
    {
      method: "GET",
      cache: "no-store",
      signal,
    },
  );

  const body = await assertOk(
    response,
  );

  const snapshot =
    parseTeacherAvailabilitySnapshotResponse(
      body,
    );

  if (!snapshot) {
    throw new TeacherAvailabilityApiError(
      response.status,
      null,
    );
  }

  return snapshot;
}

export async function replaceTeacherAvailability(
  rules: TeacherAvailabilityRuleInput[],
): Promise<TeacherAvailabilityRule[]> {
  const response = await fetch(
    "/api/profile/teacher/availability",
    {
      method: "PUT",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        rules,
      }),
    },
  );

  const body = await assertOk(
    response,
  );

  const parsed =
    parseTeacherAvailabilityRulesResponse(
      body,
    );

  if (!parsed) {
    throw new TeacherAvailabilityApiError(
      response.status,
      null,
    );
  }

  return parsed;
}

export async function createTeacherAvailabilityException(
  input: TeacherAvailabilityExceptionInput,
): Promise<TeacherAvailabilityException> {
  const response = await fetch(
    "/api/profile/teacher/availability",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const body = await assertOk(
    response,
  );

  const parsed =
    parseTeacherAvailabilityExceptionResponse(
      body,
    );

  if (!parsed) {
    throw new TeacherAvailabilityApiError(
      response.status,
      null,
    );
  }

  return parsed;
}

export async function deleteTeacherAvailabilityException(
  exceptionId: string,
): Promise<void> {
  const response = await fetch(
    "/api/profile/teacher/availability/exceptions/" +
      encodeURIComponent(exceptionId),
    {
      method: "DELETE",
    },
  );

  const body = await assertOk(
    response,
  );

  if (
    !parseTeacherAvailabilityDeleteResponse(
      body,
    )
  ) {
    throw new TeacherAvailabilityApiError(
      response.status,
      null,
    );
  }
}

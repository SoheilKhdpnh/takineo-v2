import {
  PROFILE_LANGUAGE_CODES,
  type ProfileLanguageCode,
} from "@/lib/domain/profile";
import {
  getBookingWindow,
  instantToIranDateKey,
} from "@/lib/time/iran-booking-time";

export type TeacherDiscoveryRange = {
  fromDate: string;
  toDate: string;
};

export type PublicTeacherDiscoveryItem = {
  teacherProfileId: string;
  name: string;
  image: string | null;
  headline: string | null;
  experienceYears: number | null;
  nativeLanguage: ProfileLanguageCode;
  teachingLanguage: ProfileLanguageCode;
  nextAvailableAt: string | null;
};

export type PublicTeacherDiscoveryResponse = {
  teachers: PublicTeacherDiscoveryItem[];
  nextCursor: string | null;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isNullableString(
  value: unknown,
): value is string | null {
  return (
    typeof value === "string" ||
    value === null
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


function isNullableCanonicalIdentifier(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    isCanonicalIdentifier(value)
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
    PROFILE_LANGUAGE_CODES.includes(
      value as ProfileLanguageCode,
    )
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


function isNullableIsoInstant(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    isIsoInstant(value)
  );
}

function parseTeacher(
  value: unknown,
): PublicTeacherDiscoveryItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const teacherProfileId =
    value.teacherProfileId;
  const name = value.name;
  const image = value.image;
  const headline = value.headline;
  const experienceYears =
    value.experienceYears;
  const nativeLanguage =
    value.nativeLanguage;
  const teachingLanguage =
    value.teachingLanguage;
  const nextAvailableAt =
    value.nextAvailableAt;

  if (
    !isCanonicalIdentifier(
      teacherProfileId,
    ) ||
    typeof name !== "string" ||
    !isNullableString(image) ||
    !isNullableString(headline) ||
    !isNullableNonNegativeInteger(
      experienceYears,
    ) ||
    !isProfileLanguageCode(
      nativeLanguage,
    ) ||
    !isProfileLanguageCode(
      teachingLanguage,
    ) ||
    !isNullableIsoInstant(
      nextAvailableAt,
    )
  ) {
    return null;
  }

  return {
    teacherProfileId,
    name,
    image,
    headline,
    experienceYears,
    nativeLanguage,
    teachingLanguage,
    nextAvailableAt,
  };
}

export function parseTeacherDiscoveryResponse(
  value: unknown,
): PublicTeacherDiscoveryResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidates = value.teachers;
  const nextCursor = value.nextCursor;

  if (
    !Array.isArray(candidates) ||
    !isNullableCanonicalIdentifier(
      nextCursor,
    )
  ) {
    return null;
  }

  const teachers:
    PublicTeacherDiscoveryItem[] = [];

  const seenTeacherIds =
    new Set<string>();

  for (const candidate of candidates) {
    const teacher = parseTeacher(
      candidate,
    );

    if (
      !teacher ||
      seenTeacherIds.has(
        teacher.teacherProfileId,
      )
    ) {
      return null;
    }

    seenTeacherIds.add(
      teacher.teacherProfileId,
    );
    teachers.push(teacher);
  }

  if (
    nextCursor !== null &&
    teachers.at(-1)
      ?.teacherProfileId !==
      nextCursor
  ) {
    return null;
  }

  return {
    teachers,
    nextCursor,
  };
}

export function getTeacherDiscoveryRange(
  now: Date,
): TeacherDiscoveryRange {
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

export function buildTeacherDiscoveryUrl(
  range: TeacherDiscoveryRange,
  cursor?: string | null,
): string {
  const params =
    new URLSearchParams({
      fromDate:
        range.fromDate,
      toDate:
        range.toDate,
    });

  if (cursor) {
    params.set(
      "cursor",
      cursor,
    );
  }

  return `/api/teachers?${params.toString()}`;
}

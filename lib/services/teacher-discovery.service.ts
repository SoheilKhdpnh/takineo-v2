import "server-only";

import {
  isPublicTeacher,
} from "@/lib/domain/teacher-application";
import {
  BookableTeacherNotFoundError,
} from "@/lib/errors/booking-errors";
import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  prisma,
} from "@/lib/db/prisma";
import {
  getNextBookableAvailabilityForTeachers,
  validateBookableSlotsRange,
} from "@/lib/services/bookable-slots.service";

export const TEACHER_DISCOVERY_MAX_PAGE_SIZE =
  40;

const publicTeacherDiscoverySelect = {
  id:
    true,

  headline:
    true,

  experienceYears:
    true,

  nativeLanguage:
    true,

  teachingLanguage:
    true,

  user: {
    select: {
      name:
        true,

      image:
        true,
    },
  },
} satisfies
  Prisma.TeacherProfileSelect;

export type PublicTeacherDiscoveryInput = {
  limit:
    number;

  cursor?:
    string;

  fromDate:
    string;

  toDate:
    string;
};

export type PublicTeacherDiscoveryItem = {
  teacherProfileId:
    string;

  name:
    string;

  image:
    string | null;

  headline:
    string | null;

  experienceYears:
    number | null;

  nativeLanguage:
    string;

  teachingLanguage:
    string;

  nextAvailableAt:
    Date | null;
};

export type PublicTeacherDiscoveryResult = {
  teachers:
    PublicTeacherDiscoveryItem[];

  nextCursor:
    string | null;
};

function assertDiscoveryInput(
  input:
    PublicTeacherDiscoveryInput,
): void {
  if (
    !Number.isInteger(
      input.limit,
    ) ||
    input.limit < 1 ||
    input.limit >
      TEACHER_DISCOVERY_MAX_PAGE_SIZE
  ) {
    throw new RangeError(
      `Teacher discovery limit must be an integer from 1 to ${TEACHER_DISCOVERY_MAX_PAGE_SIZE}.`,
    );
  }

  if (
    input.cursor !==
      undefined &&
    (
      input.cursor.length ===
        0 ||
      input.cursor !==
        input.cursor.trim()
    )
  ) {
    throw new RangeError(
      "Teacher discovery cursor must be a non-empty canonical identifier.",
    );
  }
}

/*
 * Public teacher discovery intentionally uses a simple,
 * deterministic primary-key order.
 *
 * No product ranking semantics exist yet, so this service
 * must not invent ratings, recommendation scores, pricing
 * priority, or availability-based ranking.
 */
export async function listPublicTeachers(
  input:
    PublicTeacherDiscoveryInput,
  options: {
    now?:
      Date;
  } = {},
): Promise<PublicTeacherDiscoveryResult> {
  assertDiscoveryInput(
    input,
  );

  /*
   * Validate bounded Tehran-slot query semantics before touching
   * candidate storage, including when no public teachers exist.
   */
  validateBookableSlotsRange({
    fromDate:
      input.fromDate,

    toDate:
      input.toDate,
  });

  /*
   * Candidate retrieval is intentionally projection-only.
   *
   * This is the architectural performance boundary:
   * PostgreSQL reads at most limit + 1 membership rows regardless
   * of how sparse public teachers are in teacher_profile ID space.
   */
  const candidateMemberships =
    await prisma
      .publicTeacherDiscoveryEligibility
      .findMany({
        ...(
          input.cursor
            ? {
                where: {
                  teacherProfileId: {
                    gt:
                      input.cursor,
                  },
                },
              }
            : {}
        ),

        orderBy: {
          teacherProfileId:
            "asc",
        },

        take:
          input.limit +
          1,

        select: {
          teacherProfileId:
            true,
        },
      });

  if (
    candidateMemberships.length ===
    0
  ) {
    return {
      teachers:
        [],

      nextCursor:
        null,
    };
  }

  const hasMore =
    candidateMemberships.length >
    input.limit;

  const pageMemberships =
    hasMore
      ? candidateMemberships.slice(
          0,
          input.limit,
        )
      : candidateMemberships;

  const pageCandidateIds =
    pageMemberships.map(
      (
        membership,
      ) =>
        membership.teacherProfileId,
    );

  /*
   * Fetch public presentation fields for only the bounded candidate
   * IDs. Do not reproduce eligibility predicates here: projection
   * synchronization owns discovery membership.
   */
  const profileRows =
    await prisma
      .teacherProfile
      .findMany({
        where: {
          id: {
            in:
              pageCandidateIds,
          },
        },

        select:
          publicTeacherDiscoverySelect,
      });

  /*
   * SQL IN does not guarantee result ordering.
   * Restore projection keyset order explicitly.
   */
  const profileById =
    new Map(
      profileRows.map(
        (
          teacher,
        ) => [
          teacher.id,
          teacher,
        ],
      ),
    );

  const pageRows =
    pageCandidateIds
      .map(
        (
          teacherProfileId,
        ) =>
          profileById.get(
            teacherProfileId,
          ) ??
          null,
      )
      .filter(
        (
          teacher,
        ): teacher is NonNullable<
          typeof teacher
        > =>
          teacher !==
          null,
      );

  if (
    pageRows.length ===
    0
  ) {
    return {
      teachers:
        [],

      nextCursor:
        hasMore
          ? (
              pageCandidateIds.at(-1) ??
              null
            )
          : null,
    };
  }

  const teacherProfileIds =
    pageRows.map(
      (
        teacher,
      ) =>
        teacher.id,
    );

  const nextAvailability =
    await getNextBookableAvailabilityForTeachers(
      teacherProfileIds,
      {
        fromDate:
          input.fromDate,

        toDate:
          input.toDate,
      },
      {
        now:
          options.now,
      },
    );

  const teachers:
    PublicTeacherDiscoveryItem[] =
      pageRows.map(
        (
          teacher,
        ) => ({
          /*
           * Explicit public DTO allowlist.
           * Never spread persistence objects into this response.
           */
          teacherProfileId:
            teacher.id,

          name:
            teacher.user.name,

          image:
            teacher.user.image,

          headline:
            teacher.headline,

          experienceYears:
            teacher.experienceYears,

          nativeLanguage:
            teacher.nativeLanguage,

          teachingLanguage:
            teacher.teachingLanguage,

          nextAvailableAt:
            nextAvailability.get(
              teacher.id,
            ) ??
            null,
        }),
      );

  return {
    teachers,

    nextCursor:
      hasMore
        ? (
            pageCandidateIds.at(-1) ??
            null
          )
        : null,
  };
}
export type PublicTeacherDetail = {
  teacherProfileId:
    string;

  name:
    string;

  image:
    string | null;

  headline:
    string | null;

  bio:
    string | null;

  experienceYears:
    number | null;

  nativeLanguage:
    string;

  teachingLanguage:
    string;
};

function assertPublicTeacherDetailId(
  teacherProfileId:
    string,
): void {
  if (
    teacherProfileId.length ===
      0 ||
    teacherProfileId !==
      teacherProfileId.trim() ||
    teacherProfileId.length >
      128 ||
    /\s/.test(
      teacherProfileId,
    )
  ) {
    throw new BookableTeacherNotFoundError();
  }
}

/*
 * Public single-teacher detail.
 *
 * Keep this select intentionally independent from applicant/admin
 * profile reads. Public callers receive only the explicit DTO below.
 *
 * Missing and non-public teachers deliberately share the same error.
 */
export async function getPublicTeacherDetail(
  teacherProfileId:
    string,
): Promise<PublicTeacherDetail> {
  assertPublicTeacherDetailId(
    teacherProfileId,
  );

  const teacher =
    await prisma
      .teacherProfile
      .findUnique({
        where: {
          id:
            teacherProfileId,
        },

        select: {
          id:
            true,

          headline:
            true,

          bio:
            true,

          experienceYears:
            true,

          nativeLanguage:
            true,

          teachingLanguage:
            true,

          applicationStatus:
            true,

          profileCompletedAt:
            true,

          user: {
            select: {
              name:
                true,

              image:
                true,

              accountStatus:
                true,
            },
          },

          introVideo: {
            select: {
              status:
                true,
            },
          },
        },
      });

  if (
    !teacher ||
    !isPublicTeacher(
      teacher.user.accountStatus,
      teacher.applicationStatus,
      teacher.profileCompletedAt,
      teacher.introVideo
        ?.status ??
        null,
    )
  ) {
    throw new BookableTeacherNotFoundError();
  }

  return {
    teacherProfileId:
      teacher.id,

    name:
      teacher.user.name,

    image:
      teacher.user.image,

    headline:
      teacher.headline,

    bio:
      teacher.bio,

    experienceYears:
      teacher.experienceYears,

    nativeLanguage:
      teacher.nativeLanguage,

    teachingLanguage:
      teacher.teachingLanguage,
  };
}

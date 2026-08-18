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

  /*
   * Eligibility-only fields.
   *
   * They are intentionally selected so the central
   * isPublicTeacher() policy can be reused defensively,
   * but they never survive public DTO mapping.
   */
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
   * Validate request semantics independently of database contents.
   *
   * An invalid range must fail even when discovery currently has
   * zero eligible teachers.
   */
  validateBookableSlotsRange({
    fromDate:
      input.fromDate,

    toDate:
      input.toDate,
  });

  const where:
    Prisma.TeacherProfileWhereInput =
      {
        /*
         * Push public eligibility into PostgreSQL so
         * undiscoverable teachers never enter the page.
         */
        applicationStatus:
          "APPROVED",

        profileCompletedAt: {
          not:
            null,
        },

        user: {
          is: {
            accountStatus:
              "ACTIVE",
          },
        },

        introVideo: {
          is: {
            status:
              "APPROVED",
          },
        },

        /*
         * Explicit keyset boundary instead of Prisma
         * cursor/skip semantics.
         *
         * This keeps pagination valid even if the prior
         * teacher becomes undiscoverable between requests.
         */
        ...(
          input.cursor
            ? {
                id: {
                  gt:
                    input.cursor,
                },
              }
            : {}
        ),
      };

  const rows =
    await prisma
      .teacherProfile
      .findMany({
        where,

        orderBy: {
          id:
            "asc",
        },

        take:
          input.limit +
          1,

        select:
          publicTeacherDiscoverySelect,
      });

  const hasMore =
    rows.length >
    input.limit;

  const candidateRows =
    hasMore
      ? rows.slice(
          0,
          input.limit,
        )
      : rows;

  /*
   * The PostgreSQL where-clause already enforces these
   * conditions. Reusing isPublicTeacher() here protects
   * against future policy drift between discovery and
   * booking eligibility.
   */
  const pageRows =
    candidateRows.filter(
      (
        teacher,
      ) =>
        isPublicTeacher(
          teacher.user
            .accountStatus,

          teacher
            .applicationStatus,

          teacher
            .profileCompletedAt,

          teacher
            .introVideo
            ?.status ??
            null,
        ),
    );

  if (
    pageRows.length ===
    0
  ) {
    return {
      teachers:
        [],

      /*
       * Under normal database invariants this is null
       * because the SQL predicate already matches the
       * central eligibility policy.
       */
      nextCursor:
        null,
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
           * Explicit public allowlist.
           *
           * Do not spread teacher/user/video records here.
           */
          teacherProfileId:
            teacher.id,

          name:
            teacher.user
              .name,

          image:
            teacher.user
              .image,

          headline:
            teacher.headline,

          experienceYears:
            teacher
              .experienceYears,

          nativeLanguage:
            teacher
              .nativeLanguage,

          teachingLanguage:
            teacher
              .teachingLanguage,

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
            pageRows.at(-1)
              ?.id ??
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

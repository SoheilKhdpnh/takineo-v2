import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { TeacherProfileForm } from "@/components/profiles/TeacherProfileForm";
import { TeacherProfileLockedView } from "@/components/profiles/TeacherProfileLockedView";
import { requireAppLocale } from "@/i18n/locale";
import { requireRolePage } from "@/lib/auth/page-guards";
import {
  canEditTeacherApplication,
  type TeacherApplicationStatus,
} from "@/lib/domain/teacher-application";
import { getTeacherProfileForUser } from "@/lib/services/teacher-profile.service";

interface TeacherProfilePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function TeacherProfilePage({
  params,
}: TeacherProfilePageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const { session } =
    await requireRolePage(
      "TEACHER",
      locale,
    );

  const profile =
    await getTeacherProfileForUser(
      session.user.id,
    );

  const t = await getTranslations({
    locale,
    namespace: "TeacherProfile",
  });

  if (
    !canEditTeacherApplication(
      profile.applicationStatus,
    )
  ) {
    const common = await getTranslations({
      locale,
      namespace: "ProfileCommon",
    });

    const lockCopy = getLockedProfileCopy(
      profile.applicationStatus,
    );

    return (
      <TeacherProfileLockedView
        eyebrow={t("eyebrow")}
        title={t("lockedTitle")}
        statusLabel={t(lockCopy.statusKey)}
        description={t(lockCopy.descriptionKey)}
        snapshotLabel={t(
          "profileSnapshot",
        )}
        footnote={t(lockCopy.footnoteKey)}
        fields={[
          {
            label: t("headline"),
            value:
              profile.headline ??
              t("notProvided"),
          },
          {
            label: t("bio"),
            value:
              profile.bio ?? t("notProvided"),
            multiline: true,
          },
          {
            label: t("experienceYears"),
            value:
              profile.experienceYears ===
              null
                ? t("notProvided")
                : String(
                    profile.experienceYears,
                  ),
          },
          {
            label: common(
              "nativeLanguage",
            ),
            value: common(
              `languages.${profile.nativeLanguage}`,
            ),
          },
          {
            label: common("timezone"),
            value: profile.timezone,
            dir: "ltr",
          },
        ]}
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium text-zinc-500">
          {t("eyebrow")}
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          {t("title")}
        </h1>

        <p className="mt-3 leading-7 text-zinc-600">
          {t("description")}
        </p>

        <div className="mt-8">
          <TeacherProfileForm
            initialValue={{
              headline:
                profile.headline ?? "",
              bio: profile.bio ?? "",
              experienceYears:
                profile.experienceYears,
              nativeLanguage:
                profile.nativeLanguage,
              timezone: profile.timezone,
            }}
          />
        </div>
      </section>
    </main>
  );
}

function getLockedProfileCopy(
  status: TeacherApplicationStatus,
) {
  switch (status) {
    case "PENDING_REVIEW":
      return {
        statusKey: "statusPendingReview" as const,
        descriptionKey:
          "lockedPendingDescription" as const,
        footnoteKey:
          "lockedPendingFootnote" as const,
      };
    case "APPROVED":
      return {
        statusKey: "statusApproved" as const,
        descriptionKey:
          "lockedApprovedDescription" as const,
        footnoteKey:
          "lockedApprovedFootnote" as const,
      };
    case "SUSPENDED":
      return {
        statusKey: "statusSuspended" as const,
        descriptionKey:
          "lockedSuspendedDescription" as const,
        footnoteKey:
          "lockedSuspendedFootnote" as const,
      };
    case "DRAFT":
    case "REJECTED":
      throw new Error(
        "Editable teacher application reached the locked profile renderer.",
      );
  }
}

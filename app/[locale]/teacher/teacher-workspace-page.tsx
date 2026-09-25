import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { TeacherAvailabilityPanel } from "@/components/availability/TeacherAvailabilityPanel";
import { TeacherApplicationSubmit } from "@/components/profiles/TeacherApplicationSubmit";
import { TeacherProfileForm } from "@/components/profiles/TeacherProfileForm";
import { UpcomingSessionsPanel } from "@/components/sessions/UpcomingSessionsPanel";
import { TeacherProfileOverview } from "@/components/teacher/TeacherProfileOverview";
import { CalendarIcon } from "@/components/ui/WorkspaceIcons";
import { requireAppLocale } from "@/i18n/locale";
import { requireRolePage } from "@/lib/auth/page-guards";
import type { ProfileTimezone } from "@/lib/domain/profile";
import { canEditTeacherApplication } from "@/lib/domain/teacher-application";
import { getTeacherProfileForUser } from "@/lib/services/teacher-profile.service";

export interface TeacherWorkspacePageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function TeacherWorkspacePage({
  params,
}: TeacherWorkspacePageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const { session } = await requireRolePage("TEACHER", locale);
  const profile = await getTeacherProfileForUser(session.user.id);
  const t = await getTranslations({
    locale,
    namespace: "TeacherProfile",
  });

  const canEdit = canEditTeacherApplication(profile.applicationStatus);
  const profileCompleted = profile.profileCompletedAt !== null;
  const timezone = profile.timezone as ProfileTimezone;

  if (!profileCompleted && canEdit) {
    return (
      <main className="px-4 py-8 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-[#edddd4] bg-white p-6 sm:p-10">
          <p className="text-sm font-semibold tracking-[0.14em] text-[#c2410c] uppercase">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm leading-7 text-zinc-600">
            {t("description")}
          </p>
          <div className="mt-8">
            <TeacherProfileForm
              initialValue={{
                headline: profile.headline ?? "",
                bio: profile.bio ?? "",
                experienceYears: profile.experienceYears,
                nativeLanguage: profile.nativeLanguage,
                timezone,
              }}
            />
          </div>
        </section>
      </main>
    );
  }

  const isApproved = profile.applicationStatus === "APPROVED";

  return (
    <main>
      <TeacherProfileOverview
        userName={session.user.name ?? ""}
        userImage={session.user.image ?? null}
        showEditor={canEdit}
        profile={{
          headline: profile.headline,
          bio: profile.bio,
          experienceYears: profile.experienceYears,
          nativeLanguage: profile.nativeLanguage,
          teachingLanguage: profile.teachingLanguage,
          timezone,
          applicationStatus: profile.applicationStatus,
          introVideoStatus: profile.introVideo?.status ?? null,
        }}
      >
        <section id="schedule" className="mt-6 scroll-mt-24">
          {isApproved ? (
            <TeacherAvailabilityPanel />
          ) : (
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-[#edddd4] bg-white p-6 sm:flex-row sm:items-center sm:p-8">
              <span
                aria-hidden="true"
                className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fff4ed] text-[#c2410c]"
              >
                <CalendarIcon />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">
                  {t("scheduleLockedTitle")}
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {t("scheduleLockedBody")}
                </p>
              </div>
            </div>
          )}
        </section>

        <section id="sessions" className="mt-6 scroll-mt-24">
          <UpcomingSessionsPanel viewerRole="TEACHER" />
        </section>

        <section id="application" className="mt-6 scroll-mt-24">
          <TeacherApplicationSubmit
            applicationStatus={profile.applicationStatus}
            profileCompleted={profileCompleted}
            videoStatus={profile.introVideo?.status ?? null}
            rejectionFeedback={
              profile.applicationStatus === "REJECTED"
                ? profile.applicationReviewNote
                : null
            }
          />
        </section>
      </TeacherProfileOverview>
    </main>
  );
}

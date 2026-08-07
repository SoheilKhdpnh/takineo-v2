import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { TeacherIntroVideoUploader } from "@/components/profiles/TeacherIntroVideoUploader";
import { requireAppLocale } from "@/i18n/locale";
import { requireRolePage } from "@/lib/auth/page-guards";
import { redirect } from "@/i18n/navigation";
import { getTeacherIntroVideoState } from "@/lib/services/teacher-intro-video.service";

interface TeacherVideoPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function TeacherVideoPage({
  params,
}: TeacherVideoPageProps) {
  const { locale: requestedLocale } =
    await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  const { session, access } =
    await requireRolePage(
      "TEACHER",
      locale,
    );

  if (
    !access.teacherProfile
      ?.profileCompletedAt
  ) {
    redirect({
      href: "/teacher/profile",
      locale,
    });
  }

  const state =
    await getTeacherIntroVideoState(
      session.user.id,
    );

  const t = await getTranslations({
    locale,
    namespace: "TeacherVideo",
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12 sm:px-6">
      <section className="mx-auto w-full max-w-3xl">
        <header className="mb-8">
          <p className="text-sm font-semibold text-zinc-500">
            {t("eyebrow")}
          </p>

          <h1 className="mt-3 text-4xl font-semibold text-zinc-950 sm:text-5xl">
            {t("title")}
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-8 text-zinc-600">
            {t("description")}
          </p>
        </header>

        <TeacherIntroVideoUploader
          applicationStatus={
            state.applicationStatus
          }
          canUpload={state.canUpload}
          initialVideo={{
            status:
              state.introVideo?.status ??
              null,

            durationSeconds:
              state.introVideo
                ?.durationSeconds ??
              null,

            rejectionReason:
              state.introVideo
                ?.rejectionReason ??
              null,
          }}
        />
      </section>
    </main>
  );
}
import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { HomeBlogTeaser } from "@/components/home/HomeBlogTeaser";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeTrust } from "@/components/home/HomeTrust";
import { FeaturedTeacherGrid } from "@/components/teachers/FeaturedTeacherGrid";
import {
  getTeacherDiscoveryRange,
  type PublicTeacherDiscoveryItem,
} from "@/components/teachers/teacher-discovery-api";
import { requireAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { listPublicTeachers } from "@/lib/services/teacher-discovery.service";
import type { ProfileLanguageCode } from "@/lib/domain/profile";

export const dynamic = "force-dynamic";

interface HomePageProps {
  params: Promise<{
    locale: string;
  }>;
}

async function loadFeaturedTeachers(): Promise<
  PublicTeacherDiscoveryItem[]
> {
  try {
    const range = getTeacherDiscoveryRange(new Date());
    const result = await listPublicTeachers({
      fromDate: range.fromDate,
      toDate: range.toDate,
      limit: 4,
    });

    return result.teachers.map((teacher) => ({
      teacherProfileId: teacher.teacherProfileId,
      name: teacher.name,
      image: teacher.image,
      headline: teacher.headline,
      experienceYears: teacher.experienceYears,
      nativeLanguage: teacher.nativeLanguage as ProfileLanguageCode,
      teachingLanguage: teacher.teachingLanguage as ProfileLanguageCode,
      nextAvailableAt: teacher.nextAvailableAt
        ? teacher.nextAvailableAt.toISOString()
        : null,
    }));
  } catch {
    return [];
  }
}

export default async function HomePage({
  params,
}: HomePageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Home",
  });

  const featuredTeachers = await loadFeaturedTeachers();

  return (
    <main>
      <HomeHero
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        findTeacher={t("findTeacher")}
        createAccount={t("createAccount")}
        imageAlt={t("heroImageAlt")}
      />

      <HomeTrust
        durationTitle={t("trustDurationTitle")}
        durationBody={t("trustDurationBody")}
        teachersTitle={t("trustTeachersTitle")}
        teachersBody={t("trustTeachersBody")}
        aiTitle={t("trustAiTitle")}
        aiBody={t("trustAiBody")}
        imageAlt={t("supportingImageAlt")}
      />

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl text-ink sm:text-3xl">{t("browseTitle")}</h2>
        <p className="mt-3 max-w-2xl text-ink-muted">{t("browseDescription")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/teachers"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            {t("browseAll")}
          </Link>
          <Link
            href="/teachers"
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink"
          >
            {t("browseSpeaking")}
          </Link>
          <Link
            href="/teachers"
            className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink"
          >
            {t("browsePersianFirst")}
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl text-ink sm:text-3xl">
              {t("featuredTitle")}
            </h2>
            <p className="mt-2 max-w-xl text-ink-muted">
              {t("featuredDescription")}
            </p>
          </div>
          <Link
            href="/teachers"
            className="hidden text-sm font-semibold text-primary sm:inline"
          >
            {t("seeAllTeachers")}
          </Link>
        </div>
        <FeaturedTeacherGrid
          locale={locale}
          teachers={featuredTeachers}
          emptyLabel={t("featuredEmpty")}
        />
      </section>

      <HomeBlogTeaser
        locale={locale}
        title={t("blogTitle")}
        description={t("blogDescription")}
        seeAllLabel={t("blogSeeAll")}
      />
    </main>
  );
}

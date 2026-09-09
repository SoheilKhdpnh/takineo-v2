import {
  setRequestLocale,
} from "next-intl/server";

import {
  TeacherBookingExperience,
} from "@/components/booking/TeacherBookingExperience";
import {
  requireAppLocale,
} from "@/i18n/locale";

interface PublicTeacherBookingPageProps {
  params: Promise<{
    locale: string;
    teacherProfileId: string;
  }>;
}

export default async function PublicTeacherBookingPage({
  params,
}: PublicTeacherBookingPageProps) {
  const {
    locale: requestedLocale,
    teacherProfileId,
  } = await params;

  const locale = requireAppLocale(
    requestedLocale,
  );

  setRequestLocale(locale);

  return (
    <TeacherBookingExperience
      teacherProfileId={
        teacherProfileId
      }
    />
  );
}

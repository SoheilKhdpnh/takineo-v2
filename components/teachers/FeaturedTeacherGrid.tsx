import { TeacherCard } from "@/components/teachers/TeacherCard";
import type { PublicTeacherDiscoveryItem } from "@/components/teachers/teacher-discovery-api";
import { BOOKING_OPERATIONAL_TIMEZONE } from "@/lib/domain/booking-policy";
import type { AppLocale } from "@/i18n/routing";

export function FeaturedTeacherGrid({
  locale,
  teachers,
  emptyLabel,
}: {
  locale: AppLocale;
  teachers: PublicTeacherDiscoveryItem[];
  emptyLabel: string;
}) {
  if (teachers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line bg-surface px-5 py-10 text-center text-ink-muted">
        {emptyLabel}
      </p>
    );
  }

  const dateTimeFormatter = new Intl.DateTimeFormat(
    locale === "fa" ? "fa-IR" : "en",
    {
      timeZone: BOOKING_OPERATIONAL_TIMEZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {teachers.map((teacher) => (
        <TeacherCard
          key={teacher.teacherProfileId}
          teacher={teacher}
          nextAvailableLabel={
            teacher.nextAvailableAt
              ? dateTimeFormatter.format(new Date(teacher.nextAvailableAt))
              : null
          }
        />
      ))}
    </div>
  );
}

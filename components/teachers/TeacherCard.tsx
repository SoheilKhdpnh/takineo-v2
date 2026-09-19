"use client";

import { useTranslations } from "next-intl";

import type { PublicTeacherDiscoveryItem } from "@/components/teachers/teacher-discovery-api";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClassName } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/ui/cn";

export function TeacherCard({
  teacher,
  nextAvailableLabel,
  className,
}: {
  teacher: PublicTeacherDiscoveryItem;
  nextAvailableLabel: string | null;
  className?: string;
}) {
  const t = useTranslations("TeacherDiscovery");
  const common = useTranslations("ProfileCommon");

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-lg border border-line bg-surface p-5",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar
          name={teacher.name}
          image={teacher.image}
        />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-ink">
            {teacher.name}
          </h3>
          <p className="mt-1 min-h-12 text-sm leading-6 text-ink-muted">
            {teacher.headline ?? t("headlineFallback")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>
          {t("nativeLanguage")}:{" "}
          {common(`languages.${teacher.nativeLanguage}`)}
        </Badge>
        <Badge tone="mint">
          {t("teachingLanguage")}:{" "}
          {common(`languages.${teacher.teachingLanguage}`)}
        </Badge>
      </div>

      {teacher.experienceYears !== null ? (
        <p className="mt-4 text-sm font-medium text-ink-muted">
          {t("experienceYears", {
            years: teacher.experienceYears,
          })}
        </p>
      ) : null}

      <div className="mt-4 rounded-md bg-accent-soft px-4 py-3">
        <p className="text-xs font-semibold text-accent">
          {t("nextAvailability")}
        </p>
        <p className="mt-1 font-semibold text-ink">
          {nextAvailableLabel ?? t("noAvailability")}
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          {t("tehranTime")}
        </p>
      </div>

      <Link
        href={`/teachers/${teacher.teacherProfileId}`}
        className={cn(
          buttonClassName({
            variant: "primary",
            className: "mt-4 w-full",
          }),
        )}
      >
        {t("viewProfileAndBook")}
      </Link>
    </article>
  );
}

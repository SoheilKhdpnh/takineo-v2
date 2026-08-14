"use client";

import {
  useTranslations,
} from "next-intl";
import {
  useState,
} from "react";

import {
  useRouter,
} from "@/i18n/navigation";
import type {
  TeacherApplicationStatus,
  TeacherIntroVideoStatus,
} from "@/lib/domain/teacher-application";

interface TeacherApplicationSubmitProps {
  applicationStatus:
    TeacherApplicationStatus;

  profileCompleted: boolean;

  videoStatus:
    TeacherIntroVideoStatus | null;

  rejectionFeedback: string | null;
}

function isSubmissionVideoReady(
  status:
    TeacherIntroVideoStatus | null,
): boolean {
  return (
    status === "READY_FOR_REVIEW" ||
    status === "APPROVED"
  );
}

export function TeacherApplicationSubmit({
  applicationStatus,
  profileCompleted,
  videoStatus,
  rejectionFeedback,
}: TeacherApplicationSubmitProps) {
  const router = useRouter();

  const t = useTranslations(
    "TeacherApplicationSubmit",
  );

  const [error, setError] =
    useState<string | null>(null);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const videoReady =
    isSubmissionVideoReady(
      videoStatus,
    );

  const applicationCanBeSubmitted =
    (
      applicationStatus ===
        "DRAFT" ||
      applicationStatus ===
        "REJECTED"
    ) &&
    profileCompleted &&
    videoReady;

  async function handleSubmit() {
    if (!applicationCanBeSubmitted) {
      return;
    }

    const confirmed =
      window.confirm(
        t("confirmation"),
      );

    if (!confirmed) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response =
        await fetch(
          "/api/profile/teacher/application",
          {
            method: "POST",
          },
        );

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      if (!response.ok) {
        const result =
          (await response.json()) as {
            error?: string;
            reason?: string;
          };

        if (
          result.reason ===
          "PROFILE_INCOMPLETE"
        ) {
          setError(
            t("profileIncomplete"),
          );
        } else if (
          result.reason ===
          "VIDEO_MISSING"
        ) {
          setError(
            t("videoMissing"),
          );
        } else if (
          result.reason ===
          "VIDEO_NOT_READY"
        ) {
          setError(
            t("videoNotReady"),
          );
        } else {
          setError(
            t("submitError"),
          );
        }

        return;
      }

      router.refresh();
    } catch {
      setError(
        t("networkError"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (
    applicationStatus ===
    "PENDING_REVIEW"
  ) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7">
        <h2 className="text-xl font-semibold text-amber-950">
          {t("pendingTitle")}
        </h2>

        <p className="mt-3 leading-7 text-amber-900">
          {t(
            "pendingDescription",
          )}
        </p>
      </section>
    );
  }

  if (
    applicationStatus ===
    "APPROVED"
  ) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7">
        <h2 className="text-xl font-semibold text-emerald-950">
          {t("approvedTitle")}
        </h2>

        <p className="mt-3 leading-7 text-emerald-900">
          {t(
            "approvedDescription",
          )}
        </p>
      </section>
    );
  }

  if (
    applicationStatus ===
    "SUSPENDED"
  ) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-7">
        <h2 className="text-xl font-semibold text-red-950">
          {t("suspendedTitle")}
        </h2>

        <p className="mt-3 leading-7 text-red-900">
          {t(
            "suspendedDescription",
          )}
        </p>
      </section>
    );
  }

  const rejected =
    applicationStatus === "REJECTED";

  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
      {rejected ? (
        <section
          aria-labelledby="teacher-application-review-feedback"
          className="mb-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <h2
            id="teacher-application-review-feedback"
            className="text-xl font-semibold"
          >
            {t("rejectedTitle")}
          </h2>

          <p className="mt-2 leading-7 text-amber-900">
            {videoStatus === "REJECTED"
              ? t("rejectedVideoDescription")
              : t("rejectedProfileDescription")}
          </p>

          <div className="mt-4 rounded-xl border border-amber-200/80 bg-white/70 p-4">
            <h3 className="text-sm font-semibold text-amber-950">
              {t("reviewerFeedback")}
            </h3>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-amber-900">
              {rejectionFeedback?.trim() ||
                t("reviewerFeedbackUnavailable")}
            </p>
          </div>
        </section>
      ) : null}

      <h2 className="text-2xl font-semibold text-zinc-950">
        {t("title")}
      </h2>

      <p className="mt-3 leading-7 text-zinc-600">
        {t("description")}
      </p>

      <div className="mt-6 space-y-3">
        <ApplicationCheck
          passed={
            profileCompleted
          }
          label={
            t("profileCheck")
          }
        />

        <ApplicationCheck
          passed={videoReady}
          label={
            t("videoCheck")
          }
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-7 text-red-700"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={
          !applicationCanBeSubmitted ||
          isSubmitting
        }
        onClick={handleSubmit}
        className="mt-6 w-full rounded-2xl bg-zinc-950 px-5 py-3.5 font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isSubmitting
          ? t("submitting")
          : t("submit")}
      </button>
    </section>
  );
}

interface ApplicationCheckProps {
  passed: boolean;
  label: string;
}

function ApplicationCheck({
  passed,
  label,
}: ApplicationCheckProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
      <span
        aria-hidden="true"
        className={[
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          passed
            ? "bg-emerald-100 text-emerald-700"
            : "bg-zinc-200 text-zinc-500",
        ].join(" ")}
      >
        {passed ? "✓" : "—"}
      </span>

      <span className="text-sm font-medium text-zinc-800">
        {label}
      </span>
    </div>
  );
}
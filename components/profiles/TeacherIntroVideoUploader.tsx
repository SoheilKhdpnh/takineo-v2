"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { AparatEmbed } from "@/components/video/AparatEmbed";
import { useRouter } from "@/i18n/navigation";
import { APARAT_SPOKEN_PHRASE } from "@/lib/domain/aparat-video";
import type {
  TeacherApplicationStatus,
  TeacherIntroVideoStatus,
} from "@/lib/domain/teacher-application";

interface IntroVideoState {
  status: TeacherIntroVideoStatus | null;
  aparatUrl: string | null;
  embedUrl: string | null;
  rejectionReason: string | null;
}

interface TeacherIntroVideoUploaderProps {
  applicationStatus: TeacherApplicationStatus;
  canEdit: boolean;
  verificationCode: string;
  initialVideo: IntroVideoState;
}

export function TeacherIntroVideoUploader({
  applicationStatus,
  canEdit,
  verificationCode,
  initialVideo,
}: TeacherIntroVideoUploaderProps) {
  const router = useRouter();
  const t = useTranslations("TeacherVideo");

  const [video, setVideo] = useState<IntroVideoState>(initialVideo);
  const [aparatUrl, setAparatUrl] = useState(initialVideo.aparatUrl ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const statusMessage = (() => {
    switch (video.status) {
      case "READY_FOR_REVIEW":
        return t("statusReadyForReview");
      case "APPROVED":
        return t("statusApproved");
      case "REJECTED":
        return t("statusRejected");
      case "UPLOAD_PENDING":
      case "PROCESSING":
      case "FAILED":
        return t("statusRetiredProvider");
      default:
        return t("statusMissing");
    }
  })();

  const applicantRejectionFeedback =
    video.status === "REJECTED"
      ? video.rejectionReason?.trim() || t("reviewFeedbackUnavailable")
      : null;

  const hasSubmittedLink = Boolean(video.aparatUrl && video.embedUrl);

  async function submitLink() {
    if (!canEdit || isSubmitting) {
      return;
    }

    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/profile/teacher/intro-video", {
        method: "PUT",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ aparatUrl }),
      });

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      const result = (await response.json().catch(() => null)) as {
        error?: string;
        introVideo?: IntroVideoState | null;
      } | null;

      if (!response.ok) {
        if (result?.error === "INVALID_APARAT_URL") {
          setError(t("invalidUrl"));
        } else if (result?.error === "TEACHER_APPLICATION_LOCKED") {
          setError(t("applicationLocked"));
        } else if (result?.error === "TEACHER_PROFILE_INCOMPLETE") {
          setError(t("profileIncomplete"));
        } else {
          setError(t("networkError"));
        }
        return;
      }

      if (result?.introVideo) {
        setVideo(result.introVideo);
        setAparatUrl(result.introVideo.aparatUrl ?? aparatUrl);
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
        <p className="text-sm font-semibold text-zinc-500">
          {t("currentStatus")}
        </p>
        <p className="mt-3 text-lg font-semibold leading-8 text-zinc-950">
          {statusMessage}
        </p>
        {video.aparatUrl ? (
          <p className="mt-2 break-all text-sm text-zinc-600" dir="ltr">
            {video.aparatUrl}
          </p>
        ) : null}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-semibold text-amber-900">
          {t("verificationTitle")}
        </p>
        <p
          className="mt-4 font-mono text-4xl font-semibold tracking-[0.28em] text-zinc-950"
          dir="ltr"
        >
          {verificationCode}
        </p>
        <p className="mt-4 text-sm leading-7 text-amber-950">
          {t("spokenInstruction")}
        </p>
        <p
          className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm font-semibold leading-7 text-zinc-950"
          dir="ltr"
        >
          {t("spokenScript", {
            phrase: APARAT_SPOKEN_PHRASE,
            code: verificationCode,
          })}
        </p>
      </section>

      {applicantRejectionFeedback ? (
        <section
          aria-labelledby="teacher-video-review-feedback-title"
          className="rounded-3xl border border-amber-200 bg-amber-50 p-6"
        >
          <p
            id="teacher-video-review-feedback-title"
            className="text-sm font-semibold text-amber-900"
          >
            {t("reviewFeedbackTitle")}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-amber-950">
            {applicantRejectionFeedback}
          </p>
        </section>
      ) : null}

      <section className="rounded-3xl border border-zinc-200 bg-white p-6">
        <h2 className="text-xl text-zinc-950">{t("requirementsTitle")}</h2>
        <div className="mt-4 space-y-2 text-sm leading-7 text-zinc-600">
          <p>{t("requirementDuration")}</p>
          <p>{t("requirementSpoken")}</p>
          <p>{t("requirementContent")}</p>
          <p>{t("requirementLanguage")}</p>
          <p>{t("requirementPublic")}</p>
        </div>
      </section>

      {!canEdit ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
          {applicationStatus === "PENDING_REVIEW"
            ? t("pendingLocked")
            : t("applicationLocked")}
        </p>
      ) : null}

      {canEdit ? (
        <form
          className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submitLink();
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-zinc-900">
              {t("urlLabel")}
            </span>
            <input
              type="url"
              name="aparatUrl"
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              value={aparatUrl}
              onChange={(event) => {
                setAparatUrl(event.target.value);
                setSaved(false);
              }}
              placeholder={t("urlPlaceholder")}
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950"
            />
          </label>
          <p className="text-sm leading-7 text-zinc-600">{t("urlHint")}</p>
          <button
            type="submit"
            disabled={isSubmitting || aparatUrl.trim().length === 0}
            className="w-full rounded-2xl bg-zinc-950 px-5 py-3.5 font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? t("saving")
              : hasSubmittedLink
                ? t("replaceVideo")
                : t("saveLink")}
          </button>
        </form>
      ) : null}

      {video.embedUrl ? (
        <section className="rounded-3xl border border-zinc-200 bg-white p-6">
          <h2 className="text-xl text-zinc-950">{t("previewTitle")}</h2>
          <p className="mt-2 text-sm leading-7 text-zinc-600">
            {t("previewDescription")}
          </p>
          <div className="mt-4">
            <AparatEmbed
              embedUrl={video.embedUrl}
              title={t("previewPlayerTitle")}
            />
          </div>
        </section>
      ) : null}

      {saved ? (
        <p
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-800"
        >
          {t("saveSuccess")}
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-3 text-sm leading-7 text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

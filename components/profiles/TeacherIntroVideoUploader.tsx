"use client";

import MuxUploader from "@mux/mux-uploader-react";
import { useTranslations } from "next-intl";
import {
  type CSSProperties,
  useEffect,
  useState,
} from "react";

import { useRouter } from "@/i18n/navigation";
import type {
  TeacherApplicationStatus,
  TeacherIntroVideoStatus,
} from "@/lib/domain/teacher-application";

interface IntroVideoState {
  status: TeacherIntroVideoStatus | null;
  durationSeconds: number | null;
  rejectionReason: string | null;
}

interface TeacherIntroVideoUploaderProps {
  applicationStatus:
    TeacherApplicationStatus;

  canUpload: boolean;

  initialVideo: IntroVideoState;
}

const pollingStatuses:
  TeacherIntroVideoStatus[] = [
    "UPLOAD_PENDING",
    "PROCESSING",
  ];

export function TeacherIntroVideoUploader({
  applicationStatus,
  canUpload,
  initialVideo,
}: TeacherIntroVideoUploaderProps) {
  const router = useRouter();
  const t = useTranslations(
    "TeacherVideo",
  );

  const [video, setVideo] =
    useState<IntroVideoState>(
      initialVideo,
    );

  const [uploadUrl, setUploadUrl] =
    useState<string | null>(null);

  const [uploadId, setUploadId] =
    useState<string | null>(null);

  const [isCreatingUpload, setIsCreatingUpload] =
    useState(false);

  const [isSyncing, setIsSyncing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (
      !video.status ||
      !pollingStatuses.includes(
        video.status,
      )
    ) {
      return;
    }

    const interval = window.setInterval(
      async () => {
        try {
          const response = await fetch(
            "/api/profile/teacher/intro-video",
            {
              method: "GET",
              cache: "no-store",
            },
          );

          if (response.status === 401) {
            router.push("/sign-in");
            router.refresh();
            return;
          }

          if (!response.ok) {
            return;
          }

          const result = (await response.json()) as {
            introVideo: {
              status:
                TeacherIntroVideoStatus;
              durationSeconds:
                number | null;
              rejectionReason:
                string | null;
            } | null;
          };
        if (result.introVideo) {
          setVideo((current) => {
            const serverVideo = {
              status:
                result.introVideo!.status,

              durationSeconds:
                result.introVideo!
                  .durationSeconds,

              rejectionReason:
                result.introVideo!
                  .rejectionReason,
            };

            /*
            * The browser already knows that the
            * upload completed successfully.
            *
            * An older DB value must never move the
            * UI backwards to UPLOAD_PENDING.
            */
            if (
              current.status ===
                "PROCESSING" &&
              serverVideo.status ===
                "UPLOAD_PENDING"
            ) {
              return current;
            }

            return serverVideo;
          });
        }
        } catch {
          /*
           * A temporary polling failure should
           * not cancel or invalidate the upload.
           */
        }
      },
      4000,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [router, video.status]);

  async function syncVideoStatus() {
  setIsSyncing(true);
  setError(null);

  try {
    const response = await fetch(
      "/api/profile/teacher/intro-video/sync",
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
      setError(
        t("statusSyncError"),
      );

      return;
    }

    const result =
      (await response.json()) as {
        introVideo: {
          status:
            TeacherIntroVideoStatus;

          durationSeconds:
            number | null;

          rejectionReason:
            string | null;
        } | null;
      };

    if (result.introVideo) {
      setVideo({
        status:
          result.introVideo.status,

        durationSeconds:
          result.introVideo
            .durationSeconds,

        rejectionReason:
          result.introVideo
            .rejectionReason,
      });
    }
  } catch {
    setError(
      t("statusSyncError"),
    );
  } finally {
    setIsSyncing(false);
  }
}

  async function createUpload() {
    setError(null);
    setIsCreatingUpload(true);

    try {
      const response = await fetch(
        "/api/profile/teacher/intro-video",
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
          };

        if (
          result.error ===
          "VIDEO_PROVIDER_UNAVAILABLE"
        ) {
          setError(
            t("providerUnavailable"),
          );
        } else if (
          result.error ===
          "TEACHER_APPLICATION_LOCKED"
        ) {
          setError(
            t("applicationLocked"),
          );
        } else {
          setError(t("createUploadError"));
        }

        return;
      }

      const result =
        (await response.json()) as {
          upload: {
            id: string;
            url: string;
          };
        };

      setUploadId(result.upload.id);
      setUploadUrl(result.upload.url);

      setVideo({
        status: "UPLOAD_PENDING",
        durationSeconds: null,
        rejectionReason: null,
      });
    } catch {
      setError(t("networkError"));
    } finally {
      setIsCreatingUpload(false);
    }
  }

  const isDurationRejection =
    video.status === "REJECTED" &&
    video.rejectionReason ===
      "VIDEO_DURATION_OUT_OF_RANGE";

  const applicantRejectionFeedback =
    video.status === "REJECTED" &&
    !isDurationRejection
      ? video.rejectionReason?.trim() ||
        t("reviewFeedbackUnavailable")
      : null;

  const statusMessage = (() => {
    switch (video.status) {
      case "UPLOAD_PENDING":
        return t("statusUploadPending");

      case "PROCESSING":
        return t("statusProcessing");

      case "READY_FOR_REVIEW":
        return t("statusReadyForReview");

      case "APPROVED":
        return t("statusApproved");

      case "REJECTED":
        return isDurationRejection
          ? t("durationRejected")
          : t("statusRejected");

      case "FAILED":
        return t("statusFailed");

      default:
        return t("statusMissing");
    }
  })();

  const mayCreateUpload =
    canUpload &&
    (
      video.status === null ||
      video.status === "REJECTED" ||
      video.status === "FAILED" ||
      (
        video.status ===
          "UPLOAD_PENDING" &&
        !uploadUrl
      )
    );

  const uploaderStyle = {
    "--progress-bar-fill-color": "#18181b",
    "--button-background-color": "#18181b",
    "--button-text-color": "#ffffff",
    width: "100%",
    minHeight: "18rem",
    borderRadius: "1.5rem",
    overflow: "hidden",
    background: "#fafafa",
    fontFamily: "var(--font-interface)",
  } as CSSProperties;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
        <p className="text-sm font-semibold text-zinc-500">
          {t("currentStatus")}
        </p>

        <p className="mt-3 text-lg font-semibold leading-8 text-zinc-950">
          {statusMessage}
        </p>

        {video.durationSeconds !== null ? (
          <p className="mt-2 text-sm text-zinc-600">
            {t("duration", {
              seconds:
                video.durationSeconds,
            })}
          </p>
        ) : null}
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
        <h2 className="text-xl text-zinc-950">
          {t("requirementsTitle")}
        </h2>

        <div className="mt-4 space-y-2 text-sm leading-7 text-zinc-600">
          <p>{t("requirementDuration")}</p>
          <p>{t("requirementContent")}</p>
          <p>{t("requirementLanguage")}</p>
          <p>{t("requirementConsent")}</p>
        </div>
      </section>

      {!canUpload ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
          {applicationStatus ===
          "PENDING_REVIEW"
            ? t("pendingLocked")
            : t("applicationLocked")}
        </p>
      ) : null}

      {mayCreateUpload &&
      !uploadUrl ? (
        <button
          type="button"
          disabled={isCreatingUpload}
          onClick={createUpload}
          className="w-full rounded-2xl bg-zinc-950 px-5 py-3.5 font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreatingUpload
            ? t("creatingUpload")
            : video.status ===
                "REJECTED" ||
              video.status === "FAILED"
              ? t("replaceVideo")
              : t("selectVideo")}
        </button>
      ) : null}

      {uploadUrl ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-4">
          <MuxUploader
            key={uploadId}
            endpoint={uploadUrl}
            maxFileSize={512000}
            dynamicChunkSize
            style={uploaderStyle}
            onSuccess={() => {
              const completedUploadId =
                uploadId;

              setUploadUrl(null);

              setVideo({
                status: "PROCESSING",
                durationSeconds: null,
                rejectionReason: null,
              });

              if (!completedUploadId) {
                return;
              }

              void fetch(
                "/api/profile/teacher/intro-video/complete",
                {
                  method: "POST",

                  headers: {
                    "Content-Type":
                      "application/json",
                  },

                  body: JSON.stringify({
                    uploadId:
                      completedUploadId,
                  }),
                },
              ).then(async (response) => {
                if (!response.ok) {
                  setError(
                    t("statusSaveError"),
                  );
                }
              }).catch(() => {
                setError(
                  t("statusSaveError"),
                );
              });
            }}
            onUploadError={() => {
              setError(t("uploadError"));
            }}
          />
        </div>
      ) : null}

      {(
        video.status === "PROCESSING" ||
        (
          video.status ===
            "UPLOAD_PENDING" &&
          !uploadUrl
        )
      ) ? (
        <button
          type="button"
          disabled={isSyncing}
          onClick={syncVideoStatus}
          className="w-full rounded-2xl border border-zinc-300 bg-white px-5 py-3.5 font-semibold text-zinc-900 transition hover:border-zinc-950 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSyncing
            ? t("checkingStatus")
            : t("checkStatus")}
        </button>
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

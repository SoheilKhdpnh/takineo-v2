"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useTranslations,
} from "next-intl";

import {
  Button,
  ButtonRow,
} from "@/components/ui/Button";
import {
  Card,
} from "@/components/ui/Card";
import {
  TalkinuWordmark,
} from "@/components/ui/TalkinuMark";
import { cn } from "@/lib/ui/cn";
import {
  SESSION_REVIEW_MAX_COMMENT_LENGTH,
} from "@/lib/domain/session-review-policy";
import {
  getRoleHome,
} from "@/lib/domain/user-role";
import {
  Link,
} from "@/i18n/navigation";

import type {
  SessionViewerRole,
  WrapUpReason,
} from "@/components/live-session/session-join-model";

type ReviewPhase =
  | "prompt"
  | "submitting"
  | "submitted"
  | "skipped"
  | "existing";

export function SessionWrapUp({
  brand,
  sessionId,
  viewerRole,
  counterpartName,
  reason,
  onSubmitReview,
}: {
  brand: string;
  sessionId: string;
  viewerRole: SessionViewerRole;
  counterpartName: string;
  reason: WrapUpReason;
  onSubmitReview: (input: {
    rating: number;
    comment: string;
  }) => Promise<"ok" | "already" | "error">;
}) {
  const t = useTranslations("LiveSessionJoin");
  const dashboardHref = getRoleHome(viewerRole);
  const canRate = viewerRole === "STUDENT" && reason !== "cancelled";
  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>(
    canRate ? "prompt" : "skipped",
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    if (!canRate) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}/review`,
          { method: "GET" },
        );

        if (!response.ok) {
          return;
        }

        const body: unknown = await response.json();
        if (
          typeof body === "object" &&
          body !== null &&
          "review" in body &&
          (body as { review: unknown }).review !== null
        ) {
          if (!cancelled) {
            setReviewPhase("existing");
          }
        }
      } catch {
        // Wrap-up still works if the optional lookup fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canRate, sessionId]);

  async function handleSubmit() {
    if (rating < 1 || reviewPhase === "submitting") {
      return;
    }

    setSubmitError(false);
    setReviewPhase("submitting");
    const result = await onSubmitReview({
      rating,
      comment,
    });

    if (result === "ok") {
      setReviewPhase("submitted");
      return;
    }

    if (result === "already") {
      setReviewPhase("existing");
      return;
    }

    setSubmitError(true);
    setReviewPhase("prompt");
  }

  const titleKey =
    reason === "cancelled"
      ? "wrapUp.cancelled"
      : reason === "time" || reason === "completed" || reason === "windowClosed"
        ? "wrapUp.endedByTime"
        : "wrapUp.endedByLeave";

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <TalkinuWordmark brand={brand} markClassName="size-8" />

        <Card className="mt-8">
          <p className="text-sm font-medium text-primary">
            {t("wrapUp.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">
            {t("wrapUp.title")}
          </h1>
          <p className="mt-3 leading-7 text-ink-muted">
            {t(titleKey, { name: counterpartName })}
          </p>
          <p className="mt-4 rounded-md bg-mint/60 px-4 py-3 text-sm leading-6 text-ink">
            {t("wrapUp.reportSoon")}
          </p>

          {canRate &&
          (reviewPhase === "prompt" || reviewPhase === "submitting") ? (
            <form
              className="mt-6"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <p className="font-semibold text-ink">
                {t("wrapUp.rateTitle")}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {t("wrapUp.rateHint")}
              </p>
              <div
                className="mt-4 flex gap-1"
                role="radiogroup"
                aria-label={t("wrapUp.rateTitle")}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={rating === value}
                    className={cn(
                      "size-11 rounded-md text-2xl leading-none text-accent transition",
                      rating >= value ? "opacity-100" : "opacity-25",
                    )}
                    onClick={() => {
                      setRating(value);
                    }}
                  >
                    ★
                    <span className="sr-only">
                      {t("wrapUp.star", { count: value })}
                    </span>
                  </button>
                ))}
              </div>
              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-medium text-ink">
                  {t("wrapUp.commentLabel")}
                </span>
                <textarea
                  className="min-h-24 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary"
                  maxLength={SESSION_REVIEW_MAX_COMMENT_LENGTH}
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                  }}
                  placeholder={t("wrapUp.commentPlaceholder")}
                />
              </label>
              {submitError ? (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {t("wrapUp.submitError")}
                </p>
              ) : null}
              <ButtonRow className="mt-6">
                <Button
                  type="submit"
                  disabled={rating < 1 || reviewPhase === "submitting"}
                >
                  {reviewPhase === "submitting"
                    ? t("wrapUp.submitting")
                    : t("wrapUp.submit")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={reviewPhase === "submitting"}
                  onClick={() => {
                    setReviewPhase("skipped");
                  }}
                >
                  {t("wrapUp.skip")}
                </Button>
              </ButtonRow>
            </form>
          ) : null}

          {reviewPhase === "submitted" || reviewPhase === "existing" ? (
            <p className="mt-6 text-sm font-medium text-primary" role="status">
              {t("wrapUp.thanks")}
            </p>
          ) : null}

          <div className="mt-8">
            <Link
              href={dashboardHref}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink transition hover:border-primary hover:bg-mint"
            >
              {t("wrapUp.backToDashboard")}
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

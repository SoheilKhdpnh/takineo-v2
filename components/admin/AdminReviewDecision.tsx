"use client";

import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

export interface AdminReviewDecisionGuard {
  reviewCycle: number;
  profileRevision: number;
  videoId: string;
  videoRevision: number;
}

type RejectionTarget = "PROFILE" | "VIDEO" | "BOTH";

type DecisionMode = "idle" | "approve" | "reject";

type DecisionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export interface AdminReviewDecisionCopy {
  description: string;
  unavailable: string;
  approve: string;
  reject: string;
  approveHeading: string;
  approveDescription: string;
  approveUnavailable: string;
  approveConfirm: string;
  rejectHeading: string;
  rejectDescription: string;
  rejectTargetLabel: string;
  rejectProfile: string;
  rejectVideo: string;
  rejectBoth: string;
  profileReasonLabel: string;
  profileReasonPlaceholder: string;
  videoReasonLabel: string;
  videoReasonPlaceholder: string;
  reasonHint: string;
  targetRequired: string;
  profileReasonRequired: string;
  videoReasonRequired: string;
  submitRejection: string;
  cancel: string;
  submitting: string;
  approveSuccess: string;
  rejectSuccess: string;
  unauthorized: string;
  forbidden: string;
  conflict: string;
  invalidRequest: string;
  genericError: string;
  reload: string;
}

interface AdminReviewDecisionProps {
  applicationId: string;
  guard: AdminReviewDecisionGuard | null;
  canApprove: boolean;
  copy: AdminReviewDecisionCopy;
}

function parseErrorCode(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function errorMessage(code: string | null, copy: AdminReviewDecisionCopy) {
  switch (code) {
    case "UNAUTHORIZED":
      return copy.unauthorized;
    case "ADMIN_FORBIDDEN":
    case "UNTRUSTED_ORIGIN":
      return copy.forbidden;
    case "APPLICATION_NOT_FOUND":
    case "REVIEW_STATE_CONFLICT":
      return copy.conflict;
    case "INVALID_REQUEST":
      return copy.invalidRequest;
    default:
      return copy.genericError;
  }
}

export function AdminReviewDecision({
  applicationId,
  guard,
  canApprove,
  copy,
}: AdminReviewDecisionProps) {
  const router = useRouter();
  const [mode, setMode] = useState<DecisionMode>("idle");
  const [state, setState] = useState<DecisionState>({ status: "idle" });
  const [target, setTarget] = useState<RejectionTarget | null>(null);
  const [profileReason, setProfileReason] = useState("");
  const [videoReason, setVideoReason] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const isSubmitting = state.status === "submitting";
  const interactionDisabled = isSubmitting || locked;

  function resetEditor() {
    if (interactionDisabled) {
      return;
    }

    setMode("idle");
    setTarget(null);
    setProfileReason("");
    setVideoReason("");
    setValidationMessage(null);
    setState({ status: "idle" });
  }

  async function submitDecision(
    endpoint: "approve" | "reject",
    body:
      | AdminReviewDecisionGuard
      | (AdminReviewDecisionGuard & {
          target: RejectionTarget;
          profileReason?: string;
          videoReason?: string;
        }),
    successMessage: string,
  ) {
    if (!guard || interactionDisabled) {
      return;
    }

    setValidationMessage(null);
    setState({ status: "submitting" });

    try {
      const response = await fetch(
        `/api/admin/teacher-applications/${encodeURIComponent(applicationId)}/${endpoint}`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const code = parseErrorCode(payload);
        if (
          code === "UNAUTHORIZED" ||
          code === "ADMIN_FORBIDDEN" ||
          code === "UNTRUSTED_ORIGIN" ||
          code === "APPLICATION_NOT_FOUND" ||
          code === "REVIEW_STATE_CONFLICT"
        ) {
          setLocked(true);
        }
        setState({
          status: "error",
          message: errorMessage(code, copy),
        });
        return;
      }

      setLocked(true);
      setMode("idle");
      setState({ status: "success", message: successMessage });
      router.refresh();
    } catch {
      setState({ status: "error", message: copy.genericError });
    }
  }

  function approve() {
    if (!guard || !canApprove) {
      return;
    }

    void submitDecision("approve", guard, copy.approveSuccess);
  }

  function reject() {
    if (!guard) {
      return;
    }

    if (!target) {
      setValidationMessage(copy.targetRequired);
      return;
    }

    const trimmedProfileReason = profileReason.trim();
    const trimmedVideoReason = videoReason.trim();

    if (
      (target === "PROFILE" || target === "BOTH") &&
      trimmedProfileReason.length < 3
    ) {
      setValidationMessage(copy.profileReasonRequired);
      return;
    }

    if (
      (target === "VIDEO" || target === "BOTH") &&
      trimmedVideoReason.length < 3
    ) {
      setValidationMessage(copy.videoReasonRequired);
      return;
    }

    void submitDecision(
      "reject",
      {
        ...guard,
        target,
        ...(target === "PROFILE" || target === "BOTH"
          ? { profileReason: trimmedProfileReason }
          : {}),
        ...(target === "VIDEO" || target === "BOTH"
          ? { videoReason: trimmedVideoReason }
          : {}),
      },
      copy.rejectSuccess,
    );
  }

  if (!guard) {
    return (
      <p className="mt-3 text-sm leading-7 text-zinc-600">
        {copy.unavailable}
      </p>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-sm leading-7 text-zinc-600">{copy.description}</p>

      {state.status === "success" ? (
        <p
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-800"
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      {state.status === "error" ? (
        <div className="mt-4">
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-800"
            role="alert"
          >
            {state.message}
          </p>
          {locked ? (
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
            >
              {copy.reload}
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "idle" && state.status !== "success" ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setMode("approve");
              setState({ status: "idle" });
              setValidationMessage(null);
            }}
            disabled={!canApprove || interactionDisabled}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-600"
          >
            {copy.approve}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("reject");
              setState({ status: "idle" });
              setValidationMessage(null);
            }}
            disabled={interactionDisabled}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {copy.reject}
          </button>
        </div>
      ) : null}

      {!canApprove && mode !== "reject" && state.status !== "success" ? (
        <p className="mt-3 text-xs font-medium leading-6 text-zinc-500">
          {copy.approveUnavailable}
        </p>
      ) : null}

      {mode === "approve" ? (
        <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5">
          <h3 className="text-base font-semibold text-zinc-950">
            {copy.approveHeading}
          </h3>
          <p className="mt-2 text-sm leading-7 text-zinc-600">
            {copy.approveDescription}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={approve}
              disabled={interactionDisabled}
              aria-busy={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? copy.submitting : copy.approveConfirm}
            </button>
            <button
              type="button"
              onClick={resetEditor}
              disabled={interactionDisabled}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {mode === "reject" ? (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/50 p-5">
          <h3 className="text-base font-semibold text-zinc-950">
            {copy.rejectHeading}
          </h3>
          <p className="mt-2 text-sm leading-7 text-zinc-600">
            {copy.rejectDescription}
          </p>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-zinc-900">
              {copy.rejectTargetLabel}
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["PROFILE", copy.rejectProfile],
                  ["VIDEO", copy.rejectVideo],
                  ["BOTH", copy.rejectBoth],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-red-100 bg-white px-3 py-2 text-sm font-medium text-zinc-700"
                >
                  <input
                    type="radio"
                    name="rejection-target"
                    value={value}
                    checked={target === value}
                    onChange={() => {
                      setTarget(value);
                      setValidationMessage(null);
                    }}
                    disabled={interactionDisabled}
                    className="size-4 accent-zinc-950"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {target === "PROFILE" || target === "BOTH" ? (
            <div className="mt-5">
              <label
                htmlFor="admin-review-profile-reason"
                className="text-sm font-semibold text-zinc-900"
              >
                {copy.profileReasonLabel}
              </label>
              <textarea
                id="admin-review-profile-reason"
                value={profileReason}
                onChange={(event) => {
                  setProfileReason(event.target.value);
                  setValidationMessage(null);
                }}
                placeholder={copy.profileReasonPlaceholder}
                minLength={3}
                maxLength={2000}
                rows={4}
                disabled={interactionDisabled}
                aria-describedby="admin-review-reason-hint"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-wait disabled:bg-zinc-100"
              />
            </div>
          ) : null}

          {target === "VIDEO" || target === "BOTH" ? (
            <div className="mt-5">
              <label
                htmlFor="admin-review-video-reason"
                className="text-sm font-semibold text-zinc-900"
              >
                {copy.videoReasonLabel}
              </label>
              <textarea
                id="admin-review-video-reason"
                value={videoReason}
                onChange={(event) => {
                  setVideoReason(event.target.value);
                  setValidationMessage(null);
                }}
                placeholder={copy.videoReasonPlaceholder}
                minLength={3}
                maxLength={2000}
                rows={4}
                disabled={interactionDisabled}
                aria-describedby="admin-review-reason-hint"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-wait disabled:bg-zinc-100"
              />
            </div>
          ) : null}

          <p
            id="admin-review-reason-hint"
            className="mt-3 text-xs font-medium leading-6 text-zinc-500"
          >
            {copy.reasonHint}
          </p>

          {validationMessage ? (
            <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
              {validationMessage}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reject}
              disabled={interactionDisabled}
              aria-busy={isSubmitting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? copy.submitting : copy.submitRejection}
            </button>
            <button
              type="button"
              onClick={resetEditor}
              disabled={interactionDisabled}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

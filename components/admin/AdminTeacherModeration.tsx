"use client";

import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

export type AdminTeacherModerationAction = "SUSPEND" | "REINSTATE";

export interface AdminTeacherModerationGuard {
  action: AdminTeacherModerationAction;
  reviewCycle: number;
}

export interface AdminTeacherModerationCopy {
  description: string;
  restricted: string;
  unavailable: string;
  suspendAction: string;
  reinstateAction: string;
  suspendHeading: string;
  suspendDescription: string;
  reinstateHeading: string;
  reinstateDescription: string;
  reasonLabel: string;
  suspendReasonPlaceholder: string;
  reinstateReasonPlaceholder: string;
  reasonHint: string;
  reasonRequired: string;
  suspendConfirm: string;
  reinstateConfirm: string;
  cancel: string;
  submitting: string;
  suspendSuccess: string;
  reinstateSuccess: string;
  unauthorized: string;
  forbidden: string;
  conflict: string;
  invalidRequest: string;
  genericError: string;
  reload: string;
}

type ModerationState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

interface AdminTeacherModerationProps {
  applicationId: string;
  canModerateTeachers: boolean;
  guard: AdminTeacherModerationGuard | null;
  copy: AdminTeacherModerationCopy;
}

function parseErrorCode(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function errorMessage(code: string | null, copy: AdminTeacherModerationCopy) {
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

export function AdminTeacherModeration({
  applicationId,
  canModerateTeachers,
  guard,
  copy,
}: AdminTeacherModerationProps) {
  const router = useRouter();
  const [state, setState] = useState<ModerationState>({ status: "idle" });
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  if (!canModerateTeachers) {
    return <p className="mt-3 text-sm leading-7 text-zinc-600">{copy.restricted}</p>;
  }

  if (!guard) {
    return <p className="mt-3 text-sm leading-7 text-zinc-600">{copy.unavailable}</p>;
  }

  const moderationGuard = guard;
  const isSuspend = moderationGuard.action === "SUSPEND";
  const isSubmitting = state.status === "submitting";
  const interactionDisabled = isSubmitting || locked;
  const actionLabel = isSuspend ? copy.suspendAction : copy.reinstateAction;
  const heading = isSuspend ? copy.suspendHeading : copy.reinstateHeading;
  const description = isSuspend
    ? copy.suspendDescription
    : copy.reinstateDescription;
  const placeholder = isSuspend
    ? copy.suspendReasonPlaceholder
    : copy.reinstateReasonPlaceholder;
  const confirmLabel = isSuspend ? copy.suspendConfirm : copy.reinstateConfirm;
  const successMessage = isSuspend ? copy.suspendSuccess : copy.reinstateSuccess;

  function resetEditor() {
    if (interactionDisabled) {
      return;
    }

    setConfirming(false);
    setReason("");
    setValidationMessage(null);
    setState({ status: "idle" });
  }

  async function submit() {
    if (interactionDisabled) {
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 3 || trimmedReason.length > 2000) {
      setValidationMessage(copy.reasonRequired);
      return;
    }

    setValidationMessage(null);
    setState({ status: "submitting" });

    try {
      const response = await fetch(
        `/api/admin/teacher-applications/${encodeURIComponent(applicationId)}/moderation`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: moderationGuard.action,
            reviewCycle: moderationGuard.reviewCycle,
            reason: trimmedReason,
          }),
        },
      );
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const code = parseErrorCode(payload);
        if (code !== "INVALID_REQUEST") {
          // Any non-validation failure can leave the browser uncertain about
          // authoritative state. Require a fresh server read before retrying.
          setLocked(true);
        }
        setState({ status: "error", message: errorMessage(code, copy) });
        return;
      }

      setLocked(true);
      setConfirming(false);
      setState({ status: "success", message: successMessage });
      router.refresh();
    } catch {
      // The request may have reached the server even if the browser lost the
      // response. Lock the editor so an administrator does not blindly repeat
      // a moderation mutation with an uncertain outcome.
      setLocked(true);
      setState({ status: "error", message: copy.genericError });
    }
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

      {!confirming && state.status !== "success" ? (
        <button
          type="button"
          onClick={() => {
            setValidationMessage(null);
            setState({ status: "idle" });
            setConfirming(true);
          }}
          className={`mt-5 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            isSuspend
              ? "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-700"
              : "bg-zinc-950 text-white hover:bg-zinc-800 focus-visible:ring-zinc-950"
          }`}
        >
          {actionLabel}
        </button>
      ) : null}

      {confirming && state.status !== "success" ? (
        <div
          className={`mt-5 rounded-2xl border p-5 ${
            isSuspend
              ? "border-red-200 bg-red-50/50"
              : "border-zinc-200 bg-white"
          }`}
        >
          <h3 className="text-base font-semibold text-zinc-950">{heading}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-600">{description}</p>

          <div className="mt-5">
            <label
              htmlFor="admin-teacher-moderation-reason"
              className="text-sm font-semibold text-zinc-900"
            >
              {copy.reasonLabel}
            </label>
            <textarea
              id="admin-teacher-moderation-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setValidationMessage(null);
              }}
              placeholder={placeholder}
              minLength={3}
              maxLength={2000}
              rows={4}
              disabled={interactionDisabled}
              aria-describedby="admin-teacher-moderation-reason-hint"
              className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-950/10 disabled:cursor-wait disabled:bg-zinc-100"
            />
          </div>

          <p
            id="admin-teacher-moderation-reason-hint"
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
              onClick={() => void submit()}
              disabled={interactionDisabled}
              aria-busy={isSubmitting}
              className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${
                isSuspend
                  ? "bg-red-700 hover:bg-red-800 focus-visible:ring-red-700"
                  : "bg-zinc-950 hover:bg-zinc-800 focus-visible:ring-zinc-950"
              }`}
            >
              {isSubmitting ? copy.submitting : confirmLabel}
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

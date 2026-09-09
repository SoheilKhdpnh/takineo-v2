"use client";

import { useEffect, useRef, useState } from "react";

interface AdminReviewPlaybackCopy {
  description: string;
  start: string;
  refresh: string;
  loading: string;
  active: string;
  expiresSoon: string;
  expired: string;
  unavailableState: string;
  unauthorized: string;
  forbidden: string;
  conflict: string;
  unavailable: string;
  genericError: string;
  playerTitle: string;
}

interface AdminReviewPlaybackProps {
  applicationId: string;
  enabled: boolean;
  copy: AdminReviewPlaybackCopy;
}

interface PlaybackGrant {
  playbackId: string;
  token: string;
  expiresInSeconds: number;
}

type PlaybackState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "active"; grant: PlaybackGrant }
  | { status: "expired" }
  | { status: "error"; message: string };

function parsePlaybackGrant(value: unknown): PlaybackGrant | null {
  if (!value || typeof value !== "object" || !("playback" in value)) {
    return null;
  }

  const playback = (value as { playback?: unknown }).playback;

  if (!playback || typeof playback !== "object") {
    return null;
  }

  const { playbackId, token, expiresInSeconds } = playback as {
    playbackId?: unknown;
    token?: unknown;
    expiresInSeconds?: unknown;
  };

  if (
    typeof playbackId !== "string" ||
    playbackId.length === 0 ||
    typeof token !== "string" ||
    token.length === 0 ||
    typeof expiresInSeconds !== "number" ||
    !Number.isInteger(expiresInSeconds) ||
    expiresInSeconds <= 0
  ) {
    return null;
  }

  return { playbackId, token, expiresInSeconds };
}

function parseErrorCode(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const error = (value as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

function errorMessage(code: string | null, copy: AdminReviewPlaybackCopy) {
  switch (code) {
    case "UNAUTHORIZED":
      return copy.unauthorized;
    case "ADMIN_FORBIDDEN":
    case "UNTRUSTED_ORIGIN":
      return copy.forbidden;
    case "APPLICATION_NOT_FOUND":
    case "REVIEW_STATE_CONFLICT":
      return copy.conflict;
    case "REVIEW_PLAYBACK_UNAVAILABLE":
      return copy.unavailable;
    default:
      return copy.genericError;
  }
}

function buildPlayerUrl(grant: PlaybackGrant) {
  const url = new URL(
    `https://player.mux.com/${encodeURIComponent(grant.playbackId)}`,
  );
  url.searchParams.set("playback-token", grant.token);
  url.searchParams.set("preload", "metadata");
  url.searchParams.set("disable-cookies", "true");
  return url.toString();
}

export function AdminReviewPlayback({
  applicationId,
  enabled,
  copy,
}: AdminReviewPlaybackProps) {
  const [state, setState] = useState<PlaybackState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state.status !== "active") {
      return;
    }

    const expiresAfterMs = Math.max(
      0,
      state.grant.expiresInSeconds * 1000,
    );
    const timeout = window.setTimeout(() => {
      setState({ status: "expired" });
    }, expiresAfterMs);

    return () => window.clearTimeout(timeout);
  }, [state]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  async function requestPlayback() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/admin/teacher-applications/${encodeURIComponent(applicationId)}/playback`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        },
      );
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setState({
          status: "error",
          message: errorMessage(parseErrorCode(payload), copy),
        });
        return;
      }

      const grant = parsePlaybackGrant(payload);
      if (!grant) {
        setState({ status: "error", message: copy.genericError });
        return;
      }

      setState({ status: "active", grant });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setState({ status: "error", message: copy.genericError });
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }

  if (!enabled) {
    return (
      <p className="mt-3 text-sm leading-7 text-zinc-600">
        {copy.unavailableState}
      </p>
    );
  }

  const isLoading = state.status === "loading";

  return (
    <div className="mt-3">
      <p className="text-sm leading-7 text-zinc-600">{copy.description}</p>

      {state.status === "active" ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-sm">
          <iframe
            src={buildPlayerUrl(state.grant)}
            title={copy.playerTitle}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
            className="aspect-video w-full border-0"
          />
        </div>
      ) : null}

      <div
        className="mt-4 min-h-6 text-xs font-medium leading-6 text-zinc-500"
        aria-live="polite"
      >
        {state.status === "loading" ? copy.loading : null}
        {state.status === "active" ? `${copy.active} ${copy.expiresSoon}` : null}
        {state.status === "expired" ? copy.expired : null}
      </div>

      {state.status === "error" ? (
        <p className="mt-2 text-sm font-medium leading-6 text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={requestPlayback}
        disabled={isLoading}
        aria-busy={isLoading}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
      >
        {isLoading
          ? copy.loading
          : state.status === "active" || state.status === "expired" || state.status === "error"
            ? copy.refresh
            : copy.start}
      </button>
    </div>
  );
}

"use client";

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  useTranslations,
} from "next-intl";

import {
  Avatar,
} from "@/components/ui/Avatar";
import {
  Button,
} from "@/components/ui/Button";
import { cn } from "@/lib/ui/cn";

import type {
  ConnectionQualityLevel,
} from "@/components/live-session/session-join-model";

function remainingLabel(endAt: string, now: number): string {
  const remainingMs = Math.max(0, new Date(endAt).getTime() - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function SessionCountdown({
  endAt,
  onElapsed,
}: {
  endAt: string;
  onElapsed: () => void;
}) {
  const t = useTranslations("LiveSessionJoin");
  const elapsedRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (elapsedRef.current) {
      return;
    }

    if (new Date(endAt).getTime() <= now) {
      elapsedRef.current = true;
      onElapsed();
    }
  }, [endAt, now, onElapsed]);

  return (
    <p
      className="font-display text-2xl font-semibold tabular-nums tracking-tight text-ink"
      dir="ltr"
      role="timer"
      aria-label={t("call.timeLeft")}
    >
      {remainingLabel(endAt, now)}
    </p>
  );
}

function qualityLabelKey(
  quality: ConnectionQualityLevel,
):
  | "call.qualityExcellent"
  | "call.qualityGood"
  | "call.qualityPoor"
  | "call.qualityLost"
  | "call.qualityUnknown" {
  switch (quality) {
    case "excellent":
      return "call.qualityExcellent";
    case "good":
      return "call.qualityGood";
    case "poor":
      return "call.qualityPoor";
    case "lost":
      return "call.qualityLost";
    default:
      return "call.qualityUnknown";
  }
}

function ParticipantTile({
  name,
  image,
  speaking,
  caption,
  showVideo,
  videoRef,
  mutedPreview,
}: {
  name: string;
  image: string | null;
  speaking: boolean;
  caption: string;
  showVideo: boolean;
  videoRef?: RefObject<HTMLVideoElement | null>;
  mutedPreview?: boolean;
}) {
  return (
    <article className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface px-4 py-8 sm:px-6">
      <div
        className="session-speak-ring relative rounded-full"
        data-speaking={speaking ? "true" : "false"}
      >
        <video
          ref={videoRef}
          className={cn(
            "size-32 rounded-full bg-ink object-cover",
            showVideo ? "block" : "hidden",
          )}
          autoPlay
          playsInline
          muted={mutedPreview}
        />
        <div className={showVideo ? "hidden" : "block"}>
          <Avatar
            name={name}
            image={image}
            size="xl"
            rounded="full"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <p className="font-semibold text-ink">{name}</p>
        <span
          className="session-wave"
          data-speaking={speaking ? "true" : "false"}
          aria-hidden="true"
        >
          <i />
          <i />
          <i />
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">{caption}</p>
    </article>
  );
}

export function SessionInCall({
  selfName,
  selfImage,
  counterpartName,
  counterpartImage,
  remotePresent,
  localSpeaking,
  remoteSpeaking,
  quality,
  reconnecting,
  muted,
  videoEnabled,
  videoDegraded,
  endAt,
  localVideoRef,
  remoteVideoRef,
  onToggleMute,
  onToggleVideo,
  onLeave,
  onElapsed,
}: {
  selfName: string;
  selfImage: string | null;
  counterpartName: string;
  counterpartImage: string | null;
  remotePresent: boolean;
  localSpeaking: boolean;
  remoteSpeaking: boolean;
  quality: ConnectionQualityLevel;
  reconnecting: boolean;
  muted: boolean;
  videoEnabled: boolean;
  videoDegraded: boolean;
  endAt: string;
  localVideoRef: RefObject<HTMLVideoElement | null>;
  remoteVideoRef: RefObject<HTMLVideoElement | null>;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
  onElapsed: () => void;
}) {
  const t = useTranslations("LiveSessionJoin");
  const showLocalVideo = videoEnabled && !videoDegraded;
  const showRemoteVideo = videoEnabled && !videoDegraded && remotePresent;

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">
              {t("call.timeLeft")}
            </p>
            <SessionCountdown endAt={endAt} onElapsed={onElapsed} />
          </div>
          <p
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              quality === "excellent" || quality === "good"
                ? "bg-mint text-primary"
                : "bg-accent-soft text-accent",
            )}
            role="status"
          >
            {t(qualityLabelKey(quality))}
          </p>
        </header>

        {reconnecting ? (
          <p
            className="mt-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-ink-muted"
            role="status"
          >
            {t("call.reconnecting")}
          </p>
        ) : null}

        {videoDegraded && videoEnabled ? (
          <p className="mt-3 text-sm text-ink-muted" role="status">
            {t("call.videoPaused")}
          </p>
        ) : null}

        <div className="mt-6 grid flex-1 gap-4 sm:grid-cols-2">
          <ParticipantTile
            name={counterpartName}
            image={counterpartImage}
            speaking={remoteSpeaking}
            caption={
              remotePresent ? counterpartName : t("call.waiting")
            }
            showVideo={showRemoteVideo}
            videoRef={remoteVideoRef}
          />
          <ParticipantTile
            name={selfName}
            image={selfImage}
            speaking={localSpeaking}
            caption={t("call.you")}
            showVideo={showLocalVideo}
            videoRef={localVideoRef}
            mutedPreview
          />
        </div>

        <div className="pointer-events-none sticky bottom-0 mt-6 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-line bg-surface/90 px-3 py-2 opacity-90 shadow-[0_18px_50px_-36px_rgba(20,34,31,0.35)] backdrop-blur-sm transition hover:opacity-100 focus-within:opacity-100">
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleMute}
            >
              {muted ? t("call.unmute") : t("call.mute")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVideo}
            >
              {videoEnabled
                ? t("call.disableVideo")
                : t("call.enableVideo")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-danger hover:bg-danger/90"
              onClick={onLeave}
            >
              {t("call.leave")}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

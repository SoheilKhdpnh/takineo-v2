"use client";

import {
  useLocale,
  useTranslations,
} from "next-intl";
import {
  useMemo,
  type RefObject,
} from "react";

import {
  Avatar,
} from "@/components/ui/Avatar";
import {
  Button,
} from "@/components/ui/Button";
import {
  Card,
} from "@/components/ui/Card";
import {
  TalkinuWordmark,
} from "@/components/ui/TalkinuMark";
import {
  BOOKING_OPERATIONAL_TIMEZONE,
} from "@/lib/domain/booking-policy";
import { cn } from "@/lib/ui/cn";

import type {
  MediaDeviceOption,
} from "@/components/live-session/use-media-preview";

export function SessionLobby({
  brand,
  counterpartName,
  counterpartImage,
  startAt,
  endAt,
  waitingToStart,
  errorMessage,
  busy,
  videoEnabled,
  onVideoEnabledChange,
  audioInputs,
  videoInputs,
  audioDeviceId,
  videoDeviceId,
  onAudioDeviceIdChange,
  onVideoDeviceIdChange,
  micPermission,
  meterFillRef,
  previewStream,
  onJoin,
}: {
  brand: string;
  counterpartName: string;
  counterpartImage: string | null;
  startAt: string;
  endAt: string;
  waitingToStart: boolean;
  errorMessage: string | null;
  busy: boolean;
  videoEnabled: boolean;
  onVideoEnabledChange: (enabled: boolean) => void;
  audioInputs: MediaDeviceOption[];
  videoInputs: MediaDeviceOption[];
  audioDeviceId: string;
  videoDeviceId: string;
  onAudioDeviceIdChange: (deviceId: string) => void;
  onVideoDeviceIdChange: (deviceId: string) => void;
  micPermission: "prompt" | "granted" | "denied";
  meterFillRef: RefObject<HTMLSpanElement | null>;
  previewStream: MediaStream | null;
  onJoin: () => void;
}) {
  const t = useTranslations("LiveSessionJoin");
  const locale = useLocale();

  const windowLabel = useMemo(() => {
    const start = new Date(startAt);
    const end = new Date(endAt);
    const dateFormatter = new Intl.DateTimeFormat(
      locale === "fa" ? "fa-IR" : "en-US",
      {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        weekday: "long",
        month: "long",
        day: "numeric",
      },
    );
    const timeFormatter = new Intl.DateTimeFormat(
      locale === "fa" ? "fa-IR" : "en-US",
      {
        timeZone: BOOKING_OPERATIONAL_TIMEZONE,
        hour: "2-digit",
        minute: "2-digit",
      },
    );

    return t("lobby.window", {
      date: dateFormatter.format(start),
      start: timeFormatter.format(start),
      end: timeFormatter.format(end),
    });
  }, [endAt, locale, startAt, t]);

  const videoTrack = previewStream?.getVideoTracks()[0] ?? null;

  return (
    <main className="flex min-h-screen flex-col bg-canvas px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <TalkinuWordmark brand={brand} markClassName="size-8" />

        <Card className="mt-8">
          <p className="text-sm font-medium text-primary">
            {t("lobby.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink">
            {t("lobby.title", { name: counterpartName })}
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-ink-muted">
            {t("lobby.description")}
          </p>

          <div className="mt-6 flex items-center gap-4 rounded-md border border-line bg-mint/50 px-4 py-3">
            <Avatar
              name={counterpartName}
              image={counterpartImage}
              size="lg"
              rounded="full"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">
                {counterpartName}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{windowLabel}</p>
            </div>
          </div>

          {waitingToStart ? (
            <p className="mt-4 text-sm text-ink-muted" role="status">
              {t("lobby.waitingToStart")}
            </p>
          ) : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                {t("lobby.deviceMic")}
              </span>
              <select
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none transition focus:border-primary"
                value={audioDeviceId}
                onChange={(event) => {
                  onAudioDeviceIdChange(event.target.value);
                }}
                disabled={busy || audioInputs.length === 0}
              >
                {audioInputs.length === 0 ? (
                  <option value="">{t("lobby.deviceUnavailable")}</option>
                ) : (
                  audioInputs.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            {videoEnabled ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">
                  {t("lobby.deviceCamera")}
                </span>
                <select
                  className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-ink outline-none transition focus:border-primary"
                  value={videoDeviceId}
                  onChange={(event) => {
                    onVideoDeviceIdChange(event.target.value);
                  }}
                  disabled={busy || videoInputs.length === 0}
                >
                  {videoInputs.length === 0 ? (
                    <option value="">{t("lobby.deviceUnavailable")}</option>
                  ) : (
                    videoInputs.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            ) : (
              <p className="self-end text-sm leading-6 text-ink-muted">
                {t("lobby.videoHint")}
              </p>
            )}
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-ink">
              {t("lobby.micMeterLabel")}
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-line"
              aria-label={t("lobby.micMeterLabel")}
            >
              <span
                ref={meterFillRef}
                className="block h-full origin-left rounded-full bg-primary"
                style={{ transform: "scaleX(0)" }}
              />
            </div>
            {micPermission === "denied" ? (
              <p className="mt-2 text-sm text-danger" role="alert">
                {t("lobby.micDenied")}
              </p>
            ) : null}
          </div>

          {videoEnabled && videoTrack ? (
            <LobbyVideoPreview stream={previewStream} />
          ) : null}

          {errorMessage ? (
            <p
              role="alert"
              className="mt-5 rounded-md border border-danger/20 bg-accent-soft px-4 py-3 text-sm leading-6 text-danger"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              disabled={busy || waitingToStart}
              onClick={onJoin}
              className="w-full sm:w-auto sm:min-w-48"
            >
              {busy ? t("lobby.joining") : t("lobby.join")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                onVideoEnabledChange(!videoEnabled);
              }}
            >
              {videoEnabled
                ? t("lobby.disableVideo")
                : t("lobby.enableVideo")}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

function LobbyVideoPreview({
  stream,
}: {
  stream: MediaStream | null;
}) {
  return (
    <video
      className={cn(
        "mt-5 aspect-video w-full max-w-sm rounded-md bg-ink object-cover",
      )}
      autoPlay
      muted
      playsInline
      ref={(element) => {
        if (element) {
          element.srcObject = stream;
        }
      }}
    />
  );
}

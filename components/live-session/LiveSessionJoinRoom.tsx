"use client";

import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from "livekit-client";
import {
  useTranslations,
} from "next-intl";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  liveSessionJoinErrorMessageKey,
} from "@/components/live-session/join-errors";
import {
  useRouter,
} from "@/i18n/navigation";

type JoinPhase =
  | "idle"
  | "authorizing"
  | "connecting"
  | "connected"
  | "denied"
  | "error";

type JoinSuccessBody = {
  credential: string;
  url: string;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJoinSuccess(
  value: unknown,
): JoinSuccessBody | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.credential !== "string" ||
    value.credential.length === 0 ||
    typeof value.url !== "string" ||
    !(
      value.url.startsWith("ws://") ||
      value.url.startsWith("wss://")
    )
  ) {
    return null;
  }

  return {
    credential: value.credential,
    url: value.url,
  };
}

function joinAttemptStorageKey(
  sessionId: string,
): string {
  return `takineo:live-join-attempt:${sessionId}`;
}

function readOrCreateJoinAttemptId(
  sessionId: string,
): string {
  const key = joinAttemptStorageKey(sessionId);

  try {
    const existing = sessionStorage.getItem(key);

    if (existing && existing.length > 0) {
      return existing;
    }

    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function clearJoinAttemptId(sessionId: string) {
  try {
    sessionStorage.removeItem(joinAttemptStorageKey(sessionId));
  } catch {
    // sessionStorage can throw in a locked browser context.
  }
}

interface LiveSessionJoinRoomProps {
  sessionId: string;
}

export function LiveSessionJoinRoom({
  sessionId,
}: LiveSessionJoinRoomProps) {
  const t = useTranslations("LiveSessionJoin");
  const {
    push,
    refresh,
  } = useRouter();
  const roomRef = useRef<Room | null>(null);
  const remoteAudioRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<JoinPhase>("idle");
  const [errorKey, setErrorKey] = useState<
    | ReturnType<typeof liveSessionJoinErrorMessageKey>
    | "errors.invalidResponse"
    | "errors.network"
    | "errors.mediaConnect"
  >("errors.generic");
  const [muted, setMuted] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;
      void room?.disconnect();
    };
  }, []);

  async function connectToRoom(
    url: string,
    credential: string,
  ) {
    const previous = roomRef.current;
    roomRef.current = null;
    await previous?.disconnect();

    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
      reconnectPolicy: {
        nextRetryDelayInMs: () => null,
      },
    });
    roomRef.current = room;

    const attachTrack = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) {
        return;
      }

      const host = remoteAudioRef.current;

      if (!host) {
        return;
      }

      const element = track.attach();
      element.autoplay = true;
      host.appendChild(element);
    };

    room.on(RoomEvent.TrackSubscribed, (track) => {
      attachTrack(track);
    });

    room.on(RoomEvent.ParticipantConnected, () => {
      setRemoteCount(room.remoteParticipants.size);
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      setRemoteCount(room.remoteParticipants.size);
    });

    room.on(RoomEvent.Disconnected, () => {
      setPhase((current) =>
        current === "connected" ? "idle" : current,
      );
      setRemoteCount(0);
    });

    setPhase("connecting");
    await room.connect(url, credential, {
      autoSubscribe: true,
      maxRetries: 0,
      peerConnectionTimeout: 30_000,
      websocketTimeout: 20_000,
      rtcConfig: {
        iceTransportPolicy: "all",
      },
    });

    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setMuted(false);
    } catch {
      setMuted(true);
    }

    setRemoteCount(room.remoteParticipants.size);
    setPhase("connected");
  }

  async function handleJoin() {
    if (phase === "authorizing" || phase === "connecting") {
      return;
    }

    setErrorKey("errors.generic");
    setPhase("authorizing");
    let authorized = false;

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientJoinAttemptId: readOrCreateJoinAttemptId(sessionId),
          }),
        },
      );

      if (response.status === 401) {
        push("/sign-in");
        refresh();
        return;
      }

      let body: unknown = null;

      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        const errorCode =
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : undefined;
        const denied =
          errorCode === "JOIN_NOT_PARTICIPANT" ||
          errorCode === "SESSION_NOT_JOINABLE" ||
          errorCode === "JOIN_WINDOW_NOT_OPEN" ||
          errorCode === "JOIN_WINDOW_CLOSED" ||
          errorCode === "ACCOUNT_INACTIVE";

        setErrorKey(liveSessionJoinErrorMessageKey(errorCode));
        setPhase(denied ? "denied" : "error");
        return;
      }

      const joined = parseJoinSuccess(body);

      if (!joined) {
        setErrorKey("errors.invalidResponse");
        setPhase("error");
        return;
      }

      authorized = true;
      await connectToRoom(joined.url, joined.credential);
    } catch {
      const room = roomRef.current;
      roomRef.current = null;
      void room?.disconnect();

      if (authorized) {
        clearJoinAttemptId(sessionId);
        setErrorKey("errors.mediaConnect");
      } else {
        setErrorKey("errors.network");
      }
      setPhase("error");
    }
  }

  async function handleLeave() {
    const room = roomRef.current;
    roomRef.current = null;
    await room?.disconnect();
    setPhase("idle");
    setRemoteCount(0);
  }

  async function handleToggleMute() {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    const nextMuted = !muted;
    await room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setMuted(nextMuted);
  }

  const busy =
    phase === "authorizing" || phase === "connecting";

  return (
    <section className="rounded-[2rem] border border-zinc-200 bg-white p-7 shadow-sm sm:p-10">
      <p className="text-sm font-medium text-zinc-500">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
        {t("title")}
      </h1>
      <p className="mt-3 max-w-xl leading-7 text-zinc-600">
        {t("description")}
      </p>
      <p className="mt-4 font-mono text-sm text-zinc-500" dir="ltr">
        {sessionId}
      </p>

      <div ref={remoteAudioRef} className="sr-only" />

      {phase === "connected" ? (
        <p className="mt-6 text-sm font-medium text-emerald-800" role="status">
          {t("connected", { count: remoteCount })}
        </p>
      ) : null}

      {phase === "denied" || phase === "error" ? (
        <p
          role="alert"
          className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900"
        >
          {t(errorKey)}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {phase === "connected" ? (
          <>
            <button
              type="button"
              onClick={() => {
                void handleToggleMute();
              }}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
            >
              {muted ? t("unmute") : t("mute")}
            </button>
            <button
              type="button"
              onClick={() => {
                void handleLeave();
              }}
              className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              {t("leave")}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleJoin();
            }}
            className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {busy ? t("joining") : t("join")}
          </button>
        )}
      </div>
    </section>
  );
}

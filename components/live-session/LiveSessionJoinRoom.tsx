"use client";

import {
  ConnectionQuality,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from "livekit-client";
import {
  useTranslations,
} from "next-intl";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  liveSessionJoinErrorMessageKey,
} from "@/components/live-session/join-errors";
import {
  SessionInCall,
} from "@/components/live-session/SessionInCall";
import {
  SessionLobby,
} from "@/components/live-session/SessionLobby";
import {
  SessionWrapUp,
} from "@/components/live-session/SessionWrapUp";
import {
  createLiveSessionRoom,
  liveSessionConnectOptions,
} from "@/components/live-session/live-session-room";
import {
  clearJoinAttemptId,
  isStrugglingQuality,
  parseJoinSuccess,
  readOrCreateJoinAttemptId,
  type ConnectionQualityLevel,
  type SessionJoinContext,
  type WrapUpReason,
} from "@/components/live-session/session-join-model";
import {
  useMediaPreview,
} from "@/components/live-session/use-media-preview";
import {
  useRouter,
} from "@/i18n/navigation";

type JoinPhase =
  | "lobby"
  | "connecting"
  | "in-session"
  | "wrap-up"
  | "denied"
  | "error";

function mapConnectionQuality(
  quality: ConnectionQuality,
): ConnectionQualityLevel {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return "excellent";
    case ConnectionQuality.Good:
      return "good";
    case ConnectionQuality.Poor:
      return "poor";
    case ConnectionQuality.Lost:
      return "lost";
    default:
      return "unknown";
  }
}

function initialPhase(
  status: SessionJoinContext["status"],
): JoinPhase {
  if (status === "CANCELLED" || status === "COMPLETED") {
    return "wrap-up";
  }

  return "lobby";
}

function initialWrapReason(
  status: SessionJoinContext["status"],
): WrapUpReason {
  if (status === "CANCELLED") {
    return "cancelled";
  }

  return "completed";
}

export function LiveSessionJoinRoom({
  brand,
  context,
}: {
  brand: string;
  context: SessionJoinContext;
}) {
  const t = useTranslations("LiveSessionJoin");
  const {
    push,
    refresh,
  } = useRouter();
  const roomRef = useRef<Room | null>(null);
  const remoteAudioRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const leavingRef = useRef(false);
  const videoEnabledRef = useRef(false);
  const [phase, setPhase] = useState<JoinPhase>(() =>
    initialPhase(context.status),
  );
  const [wrapReason, setWrapReason] = useState<WrapUpReason>(() =>
    initialWrapReason(context.status),
  );
  const [errorKey, setErrorKey] = useState<
    | ReturnType<typeof liveSessionJoinErrorMessageKey>
    | "errors.invalidResponse"
    | "errors.network"
    | "errors.mediaConnect"
  >("errors.generic");
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoDegraded, setVideoDegraded] = useState(false);
  const [remotePresent, setRemotePresent] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [quality, setQuality] = useState<ConnectionQualityLevel>("unknown");
  const [reconnecting, setReconnecting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    videoEnabledRef.current = videoEnabled;
  }, [videoEnabled]);

  const lobbyActive = phase === "lobby" || phase === "connecting" || phase === "error" || phase === "denied";
  const media = useMediaPreview({
    active: lobbyActive,
    videoEnabled,
  });

  useEffect(() => {
    if (!lobbyActive) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [lobbyActive]);

  useEffect(() => {
    return () => {
      const room = roomRef.current;
      roomRef.current = null;
      void room?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (phase !== "in-session") {
      return;
    }

    const room = roomRef.current;

    if (!room) {
      return;
    }

    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track?.kind === Track.Kind.Video) {
          const element = remoteVideoRef.current;
          if (element) {
            publication.track.attach(element);
          }
        }
      }
    }

    const camera = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (camera?.track && localVideoRef.current) {
      camera.track.attach(localVideoRef.current);
    }
  }, [phase]);

  const finishSession = useCallback((reason: WrapUpReason) => {
    leavingRef.current = true;
    const room = roomRef.current;
    roomRef.current = null;
    void room?.disconnect();
    setWrapReason(reason);
    setPhase("wrap-up");
    setRemotePresent(false);
    setLocalSpeaking(false);
    setRemoteSpeaking(false);
    setReconnecting(false);
  }, []);

  async function applyVideoState(
    room: Room,
    enabled: boolean,
  ) {
    if (!enabled) {
      await room.localParticipant.setCameraEnabled(false);
      return;
    }

    if (media.videoDeviceId) {
      await room.switchActiveDevice("videoinput", media.videoDeviceId);
    }

    const publication = await room.localParticipant.setCameraEnabled(true);
    const track = publication?.track;
    const element = localVideoRef.current;

    if (track && element) {
      track.attach(element);
    }
  }

  async function connectToRoom(
    url: string,
    credential: string,
  ) {
    const previous = roomRef.current;
    roomRef.current = null;
    await previous?.disconnect();

    const room = createLiveSessionRoom();
    roomRef.current = room;
    leavingRef.current = false;

    const attachTrack = (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const host = remoteAudioRef.current;

        if (!host) {
          return;
        }

        const element = track.attach();
        element.autoplay = true;
        host.appendChild(element);
        return;
      }

      if (track.kind === Track.Kind.Video) {
        const element = remoteVideoRef.current;

        if (element) {
          track.attach(element);
        }
      }
    };

    room.on(RoomEvent.TrackSubscribed, (track) => {
      attachTrack(track);
    });

    room.on(RoomEvent.ParticipantConnected, () => {
      setRemotePresent(room.remoteParticipants.size > 0);
    });

    room.on(RoomEvent.ParticipantDisconnected, () => {
      setRemotePresent(room.remoteParticipants.size > 0);
      setRemoteSpeaking(false);
    });

    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const speakingIds = new Set(
        speakers.map((speaker) => speaker.identity),
      );
      setLocalSpeaking(speakingIds.has(room.localParticipant.identity));
      const remote = [...room.remoteParticipants.values()][0];
      setRemoteSpeaking(
        remote ? speakingIds.has(remote.identity) : false,
      );
    });

    room.on(
      RoomEvent.ConnectionQualityChanged,
      (nextQuality, participant) => {
        if (participant !== room.localParticipant) {
          return;
        }

        const mapped = mapConnectionQuality(nextQuality);
        setQuality(mapped);
        const struggling = isStrugglingQuality(mapped);
        setReconnecting(struggling);
        setVideoDegraded(struggling);

        if (struggling && videoEnabledRef.current) {
          void room.localParticipant.setCameraEnabled(false);
        } else if (!struggling && videoEnabledRef.current) {
          void applyVideoState(room, true);
        }
      },
    );

    room.on(RoomEvent.Disconnected, () => {
      if (leavingRef.current) {
        return;
      }

      finishSession("leave");
    });

    setPhase("connecting");
    await room.connect(url, credential, liveSessionConnectOptions);

    try {
      if (media.audioDeviceId) {
        await room.switchActiveDevice("audioinput", media.audioDeviceId);
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      setMuted(false);
    } catch {
      setMuted(true);
    }

    if (videoEnabledRef.current) {
      try {
        await applyVideoState(room, true);
        setVideoDegraded(false);
      } catch {
        setVideoEnabled(false);
      }
    }

    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) {
          attachTrack(publication.track);
        }
      }
    }

    setRemotePresent(room.remoteParticipants.size > 0);
    setQuality(
      mapConnectionQuality(room.localParticipant.connectionQuality),
    );
    setPhase("in-session");
  }

  async function handleJoin() {
    if (phase === "connecting") {
      return;
    }

    setErrorKey("errors.generic");
    setPhase("connecting");
    media.stopPreview();
    let authorized = false;

    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(context.sessionId)}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientJoinAttemptId: readOrCreateJoinAttemptId(context.sessionId),
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
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : undefined;

        if (
          errorCode === "JOIN_WINDOW_CLOSED" ||
          errorCode === "SESSION_NOT_JOINABLE"
        ) {
          finishSession(
            errorCode === "JOIN_WINDOW_CLOSED"
              ? "windowClosed"
              : context.status === "CANCELLED"
                ? "cancelled"
                : "completed",
          );
          return;
        }

        const denied =
          errorCode === "JOIN_NOT_PARTICIPANT" ||
          errorCode === "JOIN_WINDOW_NOT_OPEN" ||
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
        clearJoinAttemptId(context.sessionId);
        setErrorKey("errors.mediaConnect");
      } else {
        setErrorKey("errors.network");
      }
      setPhase("error");
    }
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

  async function handleToggleVideo() {
    const room = roomRef.current;
    const next = !videoEnabled;
    setVideoEnabled(next);

    if (!room || phase !== "in-session") {
      return;
    }

    if (!next) {
      setVideoDegraded(false);
      await room.localParticipant.setCameraEnabled(false);
      return;
    }

    if (isStrugglingQuality(quality)) {
      setVideoDegraded(true);
      return;
    }

    try {
      await applyVideoState(room, true);
      setVideoDegraded(false);
    } catch {
      setVideoEnabled(false);
    }
  }

  async function handleSubmitReview(input: {
    rating: number;
    comment: string;
  }) {
    try {
      const response = await fetch(
        `/api/sessions/${encodeURIComponent(context.sessionId)}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rating: input.rating,
            comment: input.comment.trim() || undefined,
          }),
        },
      );

      if (response.status === 409) {
        const body: unknown = await response.json().catch(() => null);
        if (
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          body.error === "SESSION_REVIEW_ALREADY_SUBMITTED"
        ) {
          return "already";
        }
      }

      if (!response.ok) {
        return "error";
      }

      return "ok";
    } catch {
      return "error";
    }
  }

  const waitingToStart = now < new Date(context.startAt).getTime();
  const showLobby =
    phase === "lobby" ||
    phase === "connecting" ||
    phase === "denied" ||
    phase === "error";

  const audioHost = <div ref={remoteAudioRef} className="sr-only" />;

  if (phase === "wrap-up") {
    return (
      <>
        {audioHost}
        <SessionWrapUp
          brand={brand}
          sessionId={context.sessionId}
          viewerRole={context.viewerRole}
          counterpartName={context.counterparty.name}
          reason={wrapReason}
          onSubmitReview={handleSubmitReview}
        />
      </>
    );
  }

  if (phase === "in-session") {
    return (
      <>
        {audioHost}
        <SessionInCall
          selfName={context.selfName}
          selfImage={context.selfImage}
          counterpartName={context.counterparty.name}
          counterpartImage={context.counterparty.image}
          remotePresent={remotePresent}
          localSpeaking={localSpeaking}
          remoteSpeaking={remoteSpeaking}
          quality={quality}
          reconnecting={reconnecting}
          muted={muted}
          videoEnabled={videoEnabled}
          videoDegraded={videoDegraded}
          endAt={context.endAt}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          onToggleMute={() => {
            void handleToggleMute();
          }}
          onToggleVideo={() => {
            void handleToggleVideo();
          }}
          onLeave={() => {
            finishSession("leave");
          }}
          onElapsed={() => {
            finishSession("time");
          }}
        />
      </>
    );
  }

  if (showLobby) {
    return (
      <>
        {audioHost}
        <SessionLobby
          brand={brand}
          counterpartName={context.counterparty.name}
          counterpartImage={context.counterparty.image}
          startAt={context.startAt}
          endAt={context.endAt}
          waitingToStart={waitingToStart && phase !== "denied"}
          errorMessage={
            phase === "denied" || phase === "error" ? t(errorKey) : null
          }
          busy={phase === "connecting"}
          videoEnabled={videoEnabled}
          onVideoEnabledChange={setVideoEnabled}
          audioInputs={media.audioInputs}
          videoInputs={media.videoInputs}
          audioDeviceId={media.audioDeviceId}
          videoDeviceId={media.videoDeviceId}
          onAudioDeviceIdChange={media.setAudioDeviceId}
          onVideoDeviceIdChange={media.setVideoDeviceId}
          micPermission={media.permission}
          meterFillRef={media.meterFillRef}
          previewStream={media.previewStream}
          onJoin={() => {
            void handleJoin();
          }}
        />
      </>
    );
  }

  return audioHost;
}

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export function selectRecordingMimeType(
  isSupported: (mimeType: string) => boolean,
): string | null {
  return MIME_CANDIDATES.find((mimeType) => isSupported(mimeType)) ?? null;
}

export function recordingFileExtension(mimeType: string): string {
  if (mimeType.includes("ogg")) {
    return "ogg";
  }

  if (mimeType.includes("mp4")) {
    return "mp4";
  }

  return "webm";
}

export function sessionRecordingFileName(
  sessionId: string,
  role: "STUDENT" | "TEACHER",
  mimeType: string,
): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  const roleName = role === "TEACHER" ? "teacher" : "student";

  return `takineo-${safeId || "session"}-${roleName}.${recordingFileExtension(mimeType)}`;
}

type RecordingAudioContext = {
  createMediaStreamSource: (stream: MediaStream) => {
    connect: (destination: unknown) => void;
  };
  createMediaStreamDestination: () => { stream: MediaStream };
  resume: () => Promise<void>;
  close: () => Promise<void>;
};

type RecordingEncoder = {
  state: string;
  start: (timesliceMs: number) => void;
  stop: () => void;
  addEventListener: (
    type: "stop",
    listener: () => void,
    options: { once: true },
  ) => void;
  ondataavailable: ((event: { data: Blob }) => void) | null;
};

/**
 * Records this browser's microphone and the other person's audio into one
 * file. The file never leaves the device. This replaces LiveKit Egress when
 * the recording service cannot run beside the media server.
 */
export class BrowserSessionRecorder {
  private context: RecordingAudioContext | null = null;

  private destination: { stream: MediaStream } | null = null;

  private recorder: RecordingEncoder | null = null;

  private chunks: Blob[] = [];

  private seenTrackIds = new Set<string>();

  private clones: MediaStreamTrack[] = [];

  private mimeType = "";

  start(
    createContext: () => RecordingAudioContext = () =>
      new AudioContext() as unknown as RecordingAudioContext,
    createRecorder: (
      stream: MediaStream,
      mimeType: string,
    ) => RecordingEncoder = (stream, mimeType) =>
      new MediaRecorder(stream, { mimeType }) as unknown as RecordingEncoder,
    isSupported: (mimeType: string) => boolean = (mimeType) =>
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(mimeType),
  ): boolean {
    if (this.recorder) {
      return false;
    }

    const mimeType = selectRecordingMimeType(isSupported);

    if (!mimeType) {
      return false;
    }

    const context = createContext();
    const destination = context.createMediaStreamDestination();
    const recorder = createRecorder(destination.stream, mimeType);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    recorder.start(1000);
    this.context = context;
    this.destination = destination;
    this.recorder = recorder;
    this.mimeType = mimeType;
    void context.resume();
    return true;
  }

  addTrack(track: MediaStreamTrack): void {
    if (
      !this.context ||
      !this.destination ||
      track.kind !== "audio" ||
      this.seenTrackIds.has(track.id)
    ) {
      return;
    }

    const clone = track.clone();
    const source = this.context.createMediaStreamSource(new MediaStream([clone]));
    source.connect(this.destination);
    this.clones.push(clone);
    this.seenTrackIds.add(track.id);
  }

  async stop(): Promise<{ blob: Blob; mimeType: string } | null> {
    const recorder = this.recorder;

    if (!recorder) {
      return null;
    }

    if (recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
        recorder.stop();
      });
    }

    const blob =
      this.chunks.length > 0
        ? new Blob(this.chunks, { type: this.mimeType })
        : null;
    this.chunks = [];
    this.recorder = null;
    this.destination = null;
    for (const clone of this.clones) {
      clone.stop();
    }
    this.clones = [];
    const context = this.context;
    this.context = null;
    void context?.close();

    if (!blob || blob.size === 0) {
      return null;
    }

    return { blob, mimeType: this.mimeType };
  }
}

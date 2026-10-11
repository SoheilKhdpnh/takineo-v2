import { describe, expect, it, vi } from "vitest";

import {
  BrowserSessionRecorder,
  recordingFileExtension,
  selectRecordingMimeType,
  sessionRecordingFileName,
} from "@/components/live-session/session-recording";

describe("browser session recording", () => {
  it("picks the first supported audio type", () => {
    expect(
      selectRecordingMimeType((mimeType) => mimeType === "audio/webm"),
    ).toBe("audio/webm");
    expect(selectRecordingMimeType(() => false)).toBeNull();
  });

  it("names the download from the session and role", () => {
    expect(
      sessionRecordingFileName("cmumzpcbx000aukrkf4qcugnk", "TEACHER", "audio/webm"),
    ).toBe("takineo-cmumzpcbx000aukrkf4qcugnk-teacher.webm");
    expect(recordingFileExtension("audio/ogg;codecs=opus")).toBe("ogg");
    expect(recordingFileExtension("audio/mp4")).toBe("mp4");
  });

  it("mixes each audio track once and returns the recorded bytes", async () => {
    vi.stubGlobal(
      "MediaStream",
      class {
        constructor(public tracks: unknown[]) {}
      },
    );
    const connected: unknown[] = [];
    const chunks = [new Blob(["hello"])];
    let onData: ((event: { data: Blob }) => void) | null = null;
    const stop = vi.fn();
    const recorder = new BrowserSessionRecorder();
    const started = recorder.start(
      () => ({
        createMediaStreamSource: () => ({
          connect: (destination: unknown) => {
            connected.push(destination);
          },
        }),
        createMediaStreamDestination: () => ({ stream: {} as MediaStream }),
        resume: async () => undefined,
        close: async () => undefined,
      }),
      () => ({
        state: "recording",
        start: () => undefined,
        stop: () => {
          stop();
          onData?.({ data: chunks[0] });
        },
        addEventListener: (_type, listener) => {
          listener();
        },
        set ondataavailable(
          listener: ((event: { data: Blob }) => void) | null,
        ) {
          onData = listener;
        },
      }),
      () => true,
    );

    expect(started).toBe(true);
    const track = {
      id: "mic",
      kind: "audio",
      clone() {
        return this;
      },
      stop() {
        return undefined;
      },
    } as MediaStreamTrack;
    recorder.addTrack(track);
    recorder.addTrack(track);

    const captured = await recorder.stop();

    expect(connected).toHaveLength(1);
    expect(stop).toHaveBeenCalledOnce();
    expect(captured?.blob.size).toBeGreaterThan(0);
    expect(captured?.mimeType).toBe("audio/webm;codecs=opus");
  });
});

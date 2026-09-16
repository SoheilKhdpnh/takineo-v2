import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SessionAnalysisEngineError } from "@/lib/errors/session-analysis-errors";
import { createLocalFilesystemAudioStorage } from "@/lib/session-analysis/local-filesystem-audio";

describe("local filesystem audio storage", () => {
  it("reads a file under the configured root", async () => {
    const root = path.join(tmpdir(), `takineo-audio-${Date.now()}`);
    await mkdir(path.join(root, "sessions"), { recursive: true });
    const objectPath = path.join(root, "sessions", "student.wav");
    await writeFile(objectPath, Buffer.from("wav-bytes"));
    const storage = createLocalFilesystemAudioStorage({ root });
    const ref = {
      storageProvider: "LOCAL_FILESYSTEM" as const,
      storageBucket: "sessions",
      storageKey: "student.wav",
    };

    await expect(storage.head(ref)).resolves.toEqual({ byteSize: 9 });
    const bytes = Buffer.from(await new Response(await storage.openReadStream(ref)).arrayBuffer());
    expect(bytes.toString()).toBe("wav-bytes");
  });

  it("rejects path traversal in the object key", async () => {
    const storage = createLocalFilesystemAudioStorage({ root: tmpdir() });
    await expect(
      storage.head({
        storageProvider: "LOCAL_FILESYSTEM",
        storageBucket: "sessions",
        storageKey: "../secret.wav",
      }),
    ).rejects.toMatchObject({ code: "AUDIO_UNREADABLE" });
  });

  it("rejects a non-local storage provider", async () => {
    const storage = createLocalFilesystemAudioStorage({ root: tmpdir() });
    await expect(
      storage.head({
        storageProvider: "S3_COMPATIBLE",
        storageBucket: "sessions",
        storageKey: "student.wav",
      }),
    ).rejects.toBeInstanceOf(SessionAnalysisEngineError);
  });

  it("round-trips nested keys without leaving the root", async () => {
    const root = path.join(tmpdir(), `takineo-audio-nested-${Date.now()}`);
    await mkdir(path.join(root, "sessions", "a"), { recursive: true });
    await writeFile(path.join(root, "sessions", "a", "b.wav"), "ok");
    const storage = createLocalFilesystemAudioStorage({ root });
    const ref = {
      storageProvider: "LOCAL_FILESYSTEM" as const,
      storageBucket: "sessions",
      storageKey: "a/b.wav",
    };
    const stream = await storage.openReadStream(ref);
    expect(Buffer.from(await new Response(stream).arrayBuffer()).toString()).toBe("ok");
  });
});

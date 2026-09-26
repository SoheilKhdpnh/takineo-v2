import "server-only";

import { createReadStream } from "node:fs";
import { access, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { SessionAnalysisEngineError } from "@/lib/errors/session-analysis-errors";
import type { AudioObjectRef, AudioStoragePort } from "@/lib/session-analysis/ports";

export function createLocalFilesystemAudioStorage(input: {
  root: string;
}): AudioStoragePort {
  const root = path.resolve(input.root);

  return {
    async head(ref) {
      const objectPath = resolveObjectPath(root, ref);
      try {
        const info = await stat(objectPath);
        if (!info.isFile()) {
          return null;
        }
        return { byteSize: info.size };
      } catch {
        return null;
      }
    },

    async openReadStream(ref) {
      const objectPath = resolveObjectPath(root, ref);
      try {
        await access(objectPath);
      } catch {
        throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
      }
      return Readable.toWeb(createReadStream(objectPath)) as ReadableStream<Uint8Array>;
    },

    async delete(ref) {
      const objectPath = resolveObjectPath(root, ref);
      await rm(objectPath, { force: true });
    },
  };
}

export function resolveObjectPath(root: string, ref: AudioObjectRef): string {
  if (ref.storageProvider !== "LOCAL_FILESYSTEM") {
    throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
  }
  assertSafeSegment(ref.storageBucket);
  const keyParts = ref.storageKey.split("/");
  if (keyParts.length === 0) {
    throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
  }
  for (const part of keyParts) {
    assertSafeSegment(part);
  }
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ref.storageBucket, ...keyParts);
  const relative = path.relative(resolvedRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
  }
  return candidate;
}

function assertSafeSegment(value: string) {
  if (
    !value ||
    value !== value.trim() ||
    value === "." ||
    value === ".." ||
    value.includes("\\") ||
    value.includes("\0")
  ) {
    throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
  }
}

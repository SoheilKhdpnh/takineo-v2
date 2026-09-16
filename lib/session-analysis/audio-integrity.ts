import "server-only";

import { createHash } from "node:crypto";

import { SessionAnalysisEngineError } from "@/lib/errors/session-analysis-errors";
import type { AudioObjectRef, AudioStoragePort } from "@/lib/session-analysis/ports";

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function readVerifiedAudio(input: {
  storage: AudioStoragePort;
  ref: AudioObjectRef;
  contentSha256: string;
  byteSize: number;
}): Promise<Buffer> {
  const head = await input.storage.head(input.ref);
  if (!head || head.byteSize !== input.byteSize) {
    throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
  }

  const bytes = Buffer.from(await collectBytes(await input.storage.openReadStream(input.ref)));
  if (bytes.byteLength !== input.byteSize || sha256Hex(bytes) !== input.contentSha256) {
    throw new SessionAnalysisEngineError("AUDIO_UNREADABLE");
  }
  return bytes;
}

async function collectBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

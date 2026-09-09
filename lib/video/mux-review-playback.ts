import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getMuxClient } from "@/lib/video/mux-client";

export async function cleanupMuxReviewPlayback(input: { videoId: string; videoRevision: number; assetId: string; playbackId: string | null }) {
  if (!input.playbackId) return true;
  try {
    await getMuxClient().video.assets.deletePlaybackId(input.assetId, input.playbackId);
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "status" in error && (error as { status?: unknown }).status === 404)) return false;
  }
  await prisma.teacherIntroVideo.updateMany({
    where: { id: input.videoId, revision: input.videoRevision, reviewPlaybackId: input.playbackId },
    data: { reviewPlaybackId: null },
  });
  return true;
}

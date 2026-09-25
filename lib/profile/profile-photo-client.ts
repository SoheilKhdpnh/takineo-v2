"use client";

import { authClient } from "@/lib/auth/auth-client";

const MAX_EDGE = 512;
const MAX_BYTES = 450_000;

export async function fileToProfilePhotoDataUrl(
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("INVALID_TYPE");
  }

  if (file.size > 12 * 1024 * 1024) {
    throw new Error("TOO_LARGE");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("CANVAS");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Prefer JPEG for broad Better Auth / session compatibility.
  let quality = 0.84;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > MAX_BYTES && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > MAX_BYTES) {
    throw new Error("TOO_LARGE");
  }

  return dataUrl;
}

export async function uploadProfilePhoto(
  imageDataUrl: string,
): Promise<string> {
  const response = await fetch("/api/profile/photo", {
    method: "PUT",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDataUrl }),
  });

  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (response.status === 403) {
    throw new Error("FORBIDDEN");
  }

  if (response.status === 400) {
    throw new Error("INVALID_PHOTO");
  }

  if (!response.ok) {
    throw new Error("UPLOAD_FAILED");
  }

  const payload = (await response.json()) as { image?: unknown };

  if (typeof payload.image !== "string" || payload.image.length === 0) {
    throw new Error("INVALID_RESPONSE");
  }

  // Keep Better Auth's client session in sync so shell/header avatars update.
  const sessionUpdate = await authClient.updateUser({
    image: payload.image,
  });

  if (sessionUpdate.error) {
    // Database write already succeeded; force a session refetch as fallback.
    await authClient.getSession();
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("takineo:profile-photo", {
        detail: payload.image,
      }),
    );
  }

  return payload.image;
}

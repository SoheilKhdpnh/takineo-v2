"use client";

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

  let quality = 0.86;
  let dataUrl = canvas.toDataURL("image/webp", quality);

  while (dataUrl.length > MAX_BYTES && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/webp", quality);
  }

  if (dataUrl.length > MAX_BYTES) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.72);
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageDataUrl }),
  });

  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    throw new Error("UPLOAD_FAILED");
  }

  const payload = (await response.json()) as { image?: unknown };

  if (typeof payload.image !== "string" || payload.image.length === 0) {
    throw new Error("INVALID_RESPONSE");
  }

  return payload.image;
}

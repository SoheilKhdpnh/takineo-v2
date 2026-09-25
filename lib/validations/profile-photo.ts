import { z } from "zod";

/** Max payload after client-side resize (~512px WebP/JPEG). */
export const PROFILE_PHOTO_MAX_CHARS = 700_000;

const dataUrlPattern =
  /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$/;

export const profilePhotoInputSchema = z.object({
  imageDataUrl: z
    .string()
    .min(32)
    .max(PROFILE_PHOTO_MAX_CHARS)
    .regex(dataUrlPattern, "INVALID_IMAGE_DATA_URL"),
});

export type ProfilePhotoInput = z.infer<typeof profilePhotoInputSchema>;

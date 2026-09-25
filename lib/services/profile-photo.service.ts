import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import type { ProfilePhotoInput } from "@/lib/validations/profile-photo";

export async function updateAuthenticatedUserPhoto(
  userId: string,
  input: ProfilePhotoInput,
): Promise<{ image: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      accountStatus: true,
      role: true,
    },
  });

  if (!user || user.accountStatus !== "ACTIVE") {
    throw new ProfileNotFoundError();
  }

  if (user.role !== "STUDENT" && user.role !== "TEACHER") {
    throw new ProfileRoleMismatchError();
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      image: input.imageDataUrl,
      updatedAt: new Date(),
    },
    select: {
      image: true,
    },
  });

  if (!updated.image) {
    throw new ProfileNotFoundError();
  }

  return { image: updated.image };
}

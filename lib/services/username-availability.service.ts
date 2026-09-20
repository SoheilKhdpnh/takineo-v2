import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  isAllowedUsername,
  normalizeUsername,
} from "@/lib/domain/username";
import { InvalidUsernameError } from "@/lib/errors/signup-errors";

export async function isUsernameAvailable(username: string) {
  if (!isAllowedUsername(username)) {
    throw new InvalidUsernameError();
  }

  const existing = await prisma.user.findUnique({
    where: {
      username: normalizeUsername(username),
    },
    select: {
      id: true,
    },
  });

  return existing === null;
}

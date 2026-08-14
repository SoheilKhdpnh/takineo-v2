import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

import { AdminReviewConflictError } from "@/lib/errors/admin-errors";
import { Prisma } from "@/lib/generated/prisma/client";
import { runSerializableAdminTransaction } from "@/lib/services/admin-transaction";

function makeKnownRequestError(code: string): unknown {
  const error = Object.create(
    Prisma.PrismaClientKnownRequestError.prototype,
  );

  Object.assign(error, {
    name: "PrismaClientKnownRequestError",
    message: "Synthetic Prisma request failure.",
    code,
    clientVersion: "test",
  });

  return error;
}

beforeEach(() => {
  mocks.prisma.$transaction.mockReset();
});

describe("runSerializableAdminTransaction", () => {
  test("maps Prisma P2034 directly to the stable admin review conflict without retry", async () => {
    mocks.prisma.$transaction.mockRejectedValueOnce(
      makeKnownRequestError("P2034"),
    );

    await expect(
      runSerializableAdminTransaction(async () => "unused"),
    ).rejects.toBeInstanceOf(AdminReviewConflictError);

    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

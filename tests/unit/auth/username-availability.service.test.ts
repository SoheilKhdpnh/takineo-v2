import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
    },
  },
}));

import { InvalidUsernameError } from "@/lib/errors/signup-errors";
import { isUsernameAvailable } from "@/lib/services/username-availability.service";

describe("username availability", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
  });

  it("reports an unused valid username as available", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(isUsernameAvailable("soheil_n")).resolves.toBe(true);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username: "soheil_n" },
      select: { id: true },
    });
  });

  it("reports a taken username as unavailable", async () => {
    mocks.findUnique.mockResolvedValue({ id: "user-1" });

    await expect(isUsernameAvailable("TakenUser")).resolves.toBe(false);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { username: "takenuser" },
      select: { id: true },
    });
  });

  it("rejects reserved or malformed usernames before querying", async () => {
    await expect(isUsernameAvailable("admin")).rejects.toBeInstanceOf(
      InvalidUsernameError,
    );
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isUsernameAvailable: vi.fn(),
}));

vi.mock("@/lib/services/username-availability.service", () => ({
  isUsernameAvailable: mocks.isUsernameAvailable,
}));

import { GET } from "@/app/api/usernames/availability/route";

function request(username: string) {
  return new Request(
    `http://localhost:3000/api/usernames/availability?username=${encodeURIComponent(username)}`,
  );
}

describe("username availability route", () => {
  beforeEach(() => {
    mocks.isUsernameAvailable.mockReset();
  });

  it("returns USERNAME_TAKEN for an occupied username", async () => {
    mocks.isUsernameAvailable.mockResolvedValue(false);

    const response = await GET(request("soheil_n"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      available: false,
      error: "USERNAME_TAKEN",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns available true for a free username", async () => {
    mocks.isUsernameAvailable.mockResolvedValue(true);

    const response = await GET(request("soheil_n"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      available: true,
    });
  });

  it("returns INVALID_USERNAME for reserved names", async () => {
    const response = await GET(request("admin"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      available: false,
      error: "INVALID_USERNAME",
    });
    expect(mocks.isUsernameAvailable).not.toHaveBeenCalled();
  });
});

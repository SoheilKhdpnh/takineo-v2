import { describe, expect, it } from "vitest";

import {
  isAllowedUsername,
  isValidUsernameFormat,
  normalizeUsername,
} from "@/lib/domain/username";

describe("username rules", () => {
  it("normalizes usernames to lowercase", () => {
    expect(normalizeUsername("  Soheil_N  ")).toBe("soheil_n");
  });

  it.each(["soheil", "a_b1", "TalkinuUser_1"])(
    "accepts %s",
    (username) => {
      expect(isAllowedUsername(username)).toBe(true);
    },
  );

  it.each(["ab", "1soheil", "soheil-n", "soheil n"])(
    "rejects malformed username %s",
    (username) => {
      expect(isValidUsernameFormat(username)).toBe(false);
      expect(isAllowedUsername(username)).toBe(false);
    },
  );

  it.each(["ab", "1soheil", "soheil-n", "soheil n"])(
    "rejects malformed username %s",
    (username) => {
      expect(isValidUsernameFormat(username)).toBe(false);
      expect(isAllowedUsername(username)).toBe(false);
    },
  );

  it.each(["admin", "Talkinu", "takineo"])(
    "treats reserved name %s as unavailable but well-formed",
    (username) => {
      expect(isValidUsernameFormat(username)).toBe(true);
      expect(isAllowedUsername(username)).toBe(false);
    },
  );
});

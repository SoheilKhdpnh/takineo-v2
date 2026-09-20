// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";

import {
  clearRememberedSignup,
  readRememberedSignup,
  writeRememberedSignup,
} from "@/lib/auth/remembered-signup";

describe("remembered signup identifiers", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("stores and restores the username without a password", () => {
    writeRememberedSignup({
      method: "phone",
      username: "soheil_n",
      phoneNationalNumber: "9142928321",
    });

    expect(readRememberedSignup()).toEqual({
      method: "phone",
      username: "soheil_n",
      phoneNationalNumber: "9142928321",
    });
    expect(window.localStorage.getItem("talkinu.auth.remembered-signup")).not.toContain(
      "password",
    );
  });

  it("can forget the stored identifier", () => {
    writeRememberedSignup({
      method: "email",
      username: "soheil_n",
      email: "soheil@example.com",
    });
    clearRememberedSignup();
    expect(readRememberedSignup()).toBeNull();
  });
});

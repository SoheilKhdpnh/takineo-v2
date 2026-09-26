import { describe, expect, it } from "vitest";

import {
  getPostOnboardingHref,
  getRoleHome,
} from "@/lib/domain/user-role";

describe("user role destinations", () => {
  it("sends a new teacher to the profile step instead of the dashboard hop", () => {
    expect(getPostOnboardingHref("TEACHER")).toBe("/teacher/profile");
    expect(getRoleHome("TEACHER")).toBe("/teacher/dashboard");
  });

  it("sends a new student to the profile step instead of the dashboard hop", () => {
    expect(getPostOnboardingHref("STUDENT")).toBe("/student/profile");
    expect(getRoleHome("STUDENT")).toBe("/student/dashboard");
  });
});

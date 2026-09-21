// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  createTeacherOnboardingDraft,
  TEACHER_ONBOARDING_STEPS,
} from "@/lib/onboarding/teacher-draft";

describe("teacher onboarding draft", () => {
  it("keeps the eight application steps in the requested order", () => {
    expect(TEACHER_ONBOARDING_STEPS).toEqual([
      "about",
      "photo",
      "certification",
      "education",
      "description",
      "video",
      "availability",
      "pricing",
    ]);
  });

  it("creates an Aparat mention code and a weekly availability chart", () => {
    const draft = createTeacherOnboardingDraft("Soheil");

    expect(draft.mentionCode).toMatch(/^TALKINU-[A-Z0-9]{6}$/);
    expect(draft.availability).toHaveLength(7);
    expect(draft.pricingAcknowledged).toBe(false);
  });
});

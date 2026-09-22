// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  createTeacherOnboardingDraft,
  TEACHER_ONBOARDING_STEPS,
  TEACHER_PROFILE_PANEL_STEPS,
  TEACHER_SESSION_PANEL_STEPS,
  validateTeacherOnboardingStep,
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

  it("splits those steps across profile and session panels without overlap or gaps", () => {
    expect([...TEACHER_PROFILE_PANEL_STEPS, ...TEACHER_SESSION_PANEL_STEPS]).toEqual(
      [...TEACHER_ONBOARDING_STEPS],
    );
    expect(
      TEACHER_PROFILE_PANEL_STEPS.some((step) =>
        (TEACHER_SESSION_PANEL_STEPS as readonly string[]).includes(step),
      ),
    ).toBe(false);
  });

  it("creates an Aparat mention code and a weekly availability chart", () => {
    const draft = createTeacherOnboardingDraft("Soheil");

    expect(draft.mentionCode).toMatch(/^TALKINU-[A-Z0-9]{6}$/);
    expect(draft.availability).toHaveLength(7);
    expect(draft.pricingAcknowledged).toBe(false);
  });

  it("validates each of the eight steps independently", () => {
    const draft = createTeacherOnboardingDraft("So");
    draft.about.experienceYears = "";

    expect(validateTeacherOnboardingStep(draft, "about")).toBe("experience");
    expect(validateTeacherOnboardingStep(draft, "photo")).toBe("photo");
    expect(validateTeacherOnboardingStep(draft, "certification")).toBe("certificate");
    expect(validateTeacherOnboardingStep(draft, "education")).toBe("education");
    expect(validateTeacherOnboardingStep(draft, "description")).toBe("intro");
    expect(validateTeacherOnboardingStep(draft, "video")).toBe("aparat");

    draft.availability = draft.availability.map((day) => ({ ...day, enabled: false }));
    expect(validateTeacherOnboardingStep(draft, "availability")).toBe("availability");
    expect(validateTeacherOnboardingStep(draft, "pricing")).toBe("pricing");
  });
});

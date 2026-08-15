import type { Page } from "@playwright/test";

export const E2E_PASSWORD = "TakineoE2EOnly!2026";

export const e2ePersonas = {
  reviewer: {
    name: "E2E Reviewer",
    email: "e2e-reviewer@takineo.test",
    password: E2E_PASSWORD,
  },
  superAdmin: {
    name: "E2E Super Admin",
    email: "e2e-super-admin@takineo.test",
    password: E2E_PASSWORD,
  },
  student: {
    name: "E2E Student",
    email: "e2e-student@takineo.test",
    password: E2E_PASSWORD,
  },
  reviewApplicant: {
    name: "E2E Review Applicant",
    email: "e2e-review-applicant@takineo.test",
    password: E2E_PASSWORD,
  },
  errorApplicant: {
    name: "E2E Conflict Applicant",
    email: "e2e-conflict-applicant@takineo.test",
    password: E2E_PASSWORD,
  },
  approvedTeacher: {
    name: "E2E Approved Teacher",
    email: "e2e-approved-teacher@takineo.test",
    password: E2E_PASSWORD,
  },
} as const;

export type E2EPersona = (typeof e2ePersonas)[keyof typeof e2ePersonas];

export async function signInThroughUi(
  page: Page,
  persona: E2EPersona,
  locale: "en" | "fa" = "en",
) {
  await page.goto(`/${locale}/sign-in`);
  await page
    .getByLabel(locale === "fa" ? "ایمیل" : "Email")
    .fill(persona.email);
  await page
    .getByLabel(locale === "fa" ? "رمز عبور" : "Password")
    .fill(persona.password);
  await page
    .getByRole("button", {
      name: locale === "fa" ? "ورود" : "Sign in",
    })
    .click();
  await page.waitForURL(
    new RegExp(`/${locale}/(dashboard|onboarding|student|teacher)`),
  );
}

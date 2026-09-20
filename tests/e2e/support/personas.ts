import type { Page } from "@playwright/test";

export const E2E_PASSWORD = "TakineoE2EOnly!2026";

export const e2ePersonas = {
  reviewer: {
    name: "E2E Reviewer",
    username: "e2e_reviewer",
    email: "e2e-reviewer@takineo.test",
    password: E2E_PASSWORD,
    termsAccepted: true,
  },
  superAdmin: {
    name: "E2E Super Admin",
    username: "e2e_super_admin",
    email: "e2e-super-admin@takineo.test",
    password: E2E_PASSWORD,
    termsAccepted: true,
  },
  student: {
    name: "E2E Student",
    username: "e2e_student",
    email: "e2e-student@takineo.test",
    password: E2E_PASSWORD,
    termsAccepted: true,
  },
  reviewApplicant: {
    name: "E2E Review Applicant",
    username: "e2e_review_applicant",
    email: "e2e-review-applicant@takineo.test",
    password: E2E_PASSWORD,
    termsAccepted: true,
  },
  errorApplicant: {
    name: "E2E Conflict Applicant",
    username: "e2e_conflict_applicant",
    email: "e2e-conflict-applicant@takineo.test",
    password: E2E_PASSWORD,
    termsAccepted: true,
  },
  approvedTeacher: {
    name: "E2E Approved Teacher",
    username: "e2e_approved_teacher",
    email: "e2e-approved-teacher@takineo.test",
    password: E2E_PASSWORD,
    termsAccepted: true,
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

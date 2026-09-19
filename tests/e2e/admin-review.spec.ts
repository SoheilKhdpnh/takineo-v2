import { expect, test } from "@playwright/test";

import { e2ePersonas, signInThroughUi } from "@/tests/e2e/support/personas";

const rejectionReason =
  "Please clarify the teaching methodology and learner outcomes.";

test("reviewer opens a pending application, watches the Aparat video, and records profile rejection", async ({
  page,
}) => {
  await signInThroughUi(page, e2ePersonas.reviewer, "en");
  await page.goto("/en/admin/teacher-applications");

  const application = page.getByRole("listitem").filter({
    hasText: e2ePersonas.reviewApplicant.name,
  });
  await expect(application).toBeVisible();
  await application
    .getByRole("link", { name: "Open application" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: `Application — ${e2ePersonas.reviewApplicant.name}`,
    }),
  ).toBeVisible();

  await expect(
    page.getByText("Expected spoken code"),
  ).toBeVisible();
  await expect(
    page.getByTitle("Teacher introduction video"),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Reject application" })
    .click();
  await page.getByRole("radio", { name: "Profile only" }).check();
  await page
    .getByLabel("Profile rejection reason")
    .fill(rejectionReason);

  const rejectionResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/admin/teacher-applications/") &&
      response.url().endsWith("/reject") &&
      response.request().method() === "POST",
  );

  await page
    .getByRole("button", { name: "Confirm rejection" })
    .click();
  await expect((await rejectionResponse).status()).toBe(200);

  const browser = page.context().browser();
  if (!browser) {
    throw new Error("Playwright browser is unavailable.");
  }

  const applicantContext = await browser.newContext();
  try {
    const applicantPage = await applicantContext.newPage();
    await signInThroughUi(
      applicantPage,
      e2ePersonas.reviewApplicant,
      "en",
    );
    await applicantPage.goto("/en/teacher/dashboard");
    await expect(
      applicantPage.getByText(rejectionReason),
    ).toBeVisible();
  } finally {
    await applicantContext.close();
  }
});

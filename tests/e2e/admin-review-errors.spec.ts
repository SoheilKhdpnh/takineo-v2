import { expect, test } from "@playwright/test";

import { e2ePersonas, signInThroughUi } from "@/tests/e2e/support/personas";

test("unknown/stale approval outcome locks the editor and requires authoritative reload", async ({
  page,
}) => {
  await signInThroughUi(page, e2ePersonas.reviewer, "en");
  await page.goto("/en/admin/teacher-applications");

  const application = page.getByRole("listitem").filter({
    hasText: e2ePersonas.errorApplicant.name,
  });
  await application
    .getByRole("link", { name: "Open application" })
    .click();

  await page.route(
    "**/api/admin/teacher-applications/*/approve",
    async (route) => {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "REVIEW_STATE_CONFLICT" }),
      });
    },
  );

  await page
    .getByRole("button", { name: "Approve application" })
    .click();
  await page
    .getByRole("button", { name: "Confirm approval" })
    .click();

  await expect(
    page.getByRole("alert").filter({
      hasText: "The application changed or was already decided.",
    }),
  ).toContainText("The application changed or was already decided.");
  await expect(
    page.getByRole("button", { name: "Reload review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm approval" }),
  ).toBeDisabled();
});

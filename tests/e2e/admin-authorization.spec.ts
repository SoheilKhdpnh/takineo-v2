import { expect, test } from "@playwright/test";

import { e2ePersonas, signInThroughUi } from "@/tests/e2e/support/personas";

test("unauthenticated and non-admin users cannot enter the admin workspace", async ({
  page,
}) => {
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/sign-in$/);

  await signInThroughUi(page, e2ePersonas.student, "en");
  await page.goto("/en/admin");
  await expect(page).toHaveURL(/\/en\/student\/dashboard$/);
});

test("reviewer receives review access without super-admin moderation navigation", async ({
  page,
}) => {
  await signInThroughUi(page, e2ePersonas.reviewer, "en");
  await page.goto("/en/admin");

  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(
    page.getByRole("navigation", { name: "Administration" }),
  ).toBeVisible();
  await expect(
    page.getByText("Reviewer", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Teacher applications" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Teachers" }),
  ).toHaveCount(0);

  await page.goto("/en/admin/teachers?status=APPROVED");
  await expect(page).toHaveURL(/\/en\/admin$/);
});

test("super-admin sees the Persian RTL moderation workspace and approved teacher", async ({
  page,
}) => {
  await signInThroughUi(page, e2ePersonas.superAdmin, "fa");
  await page.goto("/fa/admin");

  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.getByRole("link", { name: "مدرس‌ها", exact: true }).click();
  await expect(page).toHaveURL(/\/fa\/admin\/teachers\?status=APPROVED$/);
  await expect(page.getByRole("heading", { name: e2ePersonas.approvedTeacher.name, exact: true })).toBeVisible();
});

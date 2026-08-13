import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  describe,
  expect,
  it,
} from "vitest";

const root = fileURLToPath(
  new URL("../../../", import.meta.url),
);

async function readCatalog(locale: "fa" | "en") {
  const source = await readFile(
    `${root}messages/${locale}.json`,
    "utf8",
  );

  return JSON.parse(source) as Record<
    string,
    Record<string, string>
  >;
}

describe("admin localization catalogs", () => {
  it("keeps the Persian and English admin namespaces in structural parity", async () => {
    const [fa, en] = await Promise.all([
      readCatalog("fa"),
      readCatalog("en"),
    ]);

    for (const namespace of [
      "AdminShell",
      "AdminDashboard",
      "AdminReviewQueue",
      "AdminReviewDetail",
    ]) {
      expect(fa[namespace]).toBeDefined();
      expect(en[namespace]).toBeDefined();

      expect(
        Object.keys(fa[namespace]).sort(),
      ).toEqual(
        Object.keys(en[namespace]).sort(),
      );

      expect(
        Object.values(fa[namespace]).every(
          (value) => value.trim().length > 0,
        ),
      ).toBe(true);

      expect(
        Object.values(en[namespace]).every(
          (value) => value.trim().length > 0,
        ),
      ).toBe(true);
    }

    expect(en.AdminShell.workspace).toBe(
      "Admin workspace",
    );
    expect(fa.AdminShell.workspace).toBe(
      "فضای مدیریت",
    );
    expect(en.AdminShell.teacherApplications).toBe(
      "Teacher applications",
    );
    expect(fa.AdminShell.teacherApplications).toBe(
      "درخواست‌های مدرس‌ها",
    );
    expect(en.AdminDashboard.eyebrow).toBe(
      "Administration overview",
    );
    expect(fa.AdminDashboard.eyebrow).toBe(
      "نمای کلی مدیریت",
    );
    expect(en.AdminReviewQueue.title).toBe(
      "Pending teacher applications",
    );
    expect(fa.AdminReviewQueue.title).toBe(
      "درخواست‌های در انتظار بررسی",
    );
    expect(en.AdminReviewDetail.eyebrow).toBe(
      "Application detail",
    );
    expect(en.AdminReviewDetail.playbackStart).toBe(
      "Load private playback",
    );
    expect(fa.AdminReviewDetail.playbackStart).toBe(
      "بارگذاری پخش خصوصی",
    );
    expect(en.AdminReviewDetail.decisionHeading).toBe(
      "Review decision",
    );
    expect(fa.AdminReviewDetail.decisionHeading).toBe(
      "تصمیم بررسی",
    );
    expect(en.AdminReviewDetail.approveAction).toBe(
      "Approve application",
    );
    expect(fa.AdminReviewDetail.rejectAction).toBe(
      "رد درخواست",
    );
    expect(fa.AdminReviewDetail.eyebrow).toBe(
      "جزئیات درخواست",
    );
  });
});

import { describe, expect, it } from "vitest";
import matter from "gray-matter";

import {
  formatBlogDate,
  isBlogPostVisibleInLocale,
  parseBlogPostSource,
  sortBlogPostsByDateDesc,
} from "@/lib/blog/parse-post";

const sample = `---
title: "A speaking habit"
date: "2026-09-10"
excerpt: "Short excerpt"
coverImage: "/images/blog/sample.webp"
tags:
  - speaking
---

Body paragraph.
`;

describe("blog post parsing", () => {
  it("reads required frontmatter and the MDX body", () => {
    const post = parseBlogPostSource("a-speaking-habit", sample, matter);

    expect(post.slug).toBe("a-speaking-habit");
    expect(post.title).toBe("A speaking habit");
    expect(post.date).toBe("2026-09-10");
    expect(post.coverImage).toBe("/images/blog/sample.webp");
    expect(post.tags).toEqual(["speaking"]);
    expect(post.content).toContain("Body paragraph.");
  });

  it("rejects an invalid date", () => {
    expect(() =>
      parseBlogPostSource(
        "bad",
        sample.replace("2026-09-10", "10/09/2026"),
        matter,
      ),
    ).toThrow();
  });

  it("hides locale-specific posts from the other locale", () => {
    const post = parseBlogPostSource(
      "fa-only",
      sample.replace("---\n", "---\nlocale: fa\n"),
      matter,
    );

    expect(isBlogPostVisibleInLocale(post, "fa")).toBe(true);
    expect(isBlogPostVisibleInLocale(post, "en")).toBe(false);
  });

  it("sorts newest posts first", () => {
    const older = parseBlogPostSource(
      "older",
      sample.replace("2026-09-10", "2026-09-01"),
      matter,
    );
    const newer = parseBlogPostSource("newer", sample, matter);

    expect(sortBlogPostsByDateDesc([older, newer]).map((post) => post.slug)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("formats dates for English and Persian chrome", () => {
    expect(formatBlogDate("2026-09-10", "en")).toMatch(/September/);
    expect(formatBlogDate("2026-09-10", "fa")).not.toMatch(/September/);
  });
});

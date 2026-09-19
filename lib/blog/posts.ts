import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import {
  isBlogPostVisibleInLocale,
  parseBlogPostSource,
  sortBlogPostsByDateDesc,
  type BlogPost,
} from "@/lib/blog/parse-post";

const BLOG_DIRECTORY = path.join(
  process.cwd(),
  "content",
  "blog",
);

function listMdxFiles(): string[] {
  return readdirSync(BLOG_DIRECTORY).filter(
    (filename) =>
      filename.endsWith(".mdx") &&
      !filename.startsWith("_"),
  );
}

export function listBlogPosts(locale?: string): BlogPost[] {
  const posts = listMdxFiles().map((filename) => {
    const slug = filename.replace(/\.mdx$/, "");
    const raw = readFileSync(
      path.join(BLOG_DIRECTORY, filename),
      "utf8",
    );

    return parseBlogPostSource(slug, raw, matter);
  });

  const visible =
    locale === undefined
      ? posts
      : posts.filter((post) =>
          isBlogPostVisibleInLocale(post, locale),
        );

  return sortBlogPostsByDateDesc(visible);
}

export function getBlogPost(
  slug: string,
  locale?: string,
): BlogPost | null {
  const post = listBlogPosts(locale).find(
    (candidate) => candidate.slug === slug,
  );

  return post ?? null;
}

export function getLatestBlogPosts(
  locale: string,
  limit = 3,
): BlogPost[] {
  return listBlogPosts(locale).slice(0, limit);
}

import type { MetadataRoute } from "next";

import { isBlogPostVisibleInLocale } from "@/lib/blog/parse-post";
import { listBlogPosts } from "@/lib/blog/posts";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

const publicPaths = ["", "/teachers", "/blog", "/sign-in", "/sign-up"];

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = listBlogPosts();

  return routing.locales.flatMap((locale) => [
    ...publicPaths.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
    })),
    ...posts
      .filter((post) => isBlogPostVisibleInLocale(post, locale))
      .map((post) => ({
        url: `${SITE_URL}/${locale}/blog/${post.slug}`,
      })),
  ]);
}

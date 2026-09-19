import type { Metadata } from "next";
import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { requireAppLocale } from "@/i18n/locale";
import { listBlogPosts } from "@/lib/blog/posts";

interface BlogIndexPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({
  params,
}: BlogIndexPageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);
  const t = await getTranslations({
    locale,
    namespace: "Blog",
  });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function BlogIndexPage({
  params,
}: BlogIndexPageProps) {
  const { locale: requestedLocale } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const t = await getTranslations({
    locale,
    namespace: "Blog",
  });
  const posts = listBlogPosts(locale);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
      <h1 className="mt-4 max-w-3xl text-4xl text-ink sm:text-5xl">
        {t("title")}
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-muted">
        {t("description")}
      </p>

      {posts.length === 0 ? (
        <p className="mt-12 text-ink-muted">{t("empty")}</p>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogPostCard
              key={post.slug}
              post={post}
              locale={locale}
            />
          ))}
        </div>
      )}
    </main>
  );
}

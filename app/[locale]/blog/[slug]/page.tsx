import { MDXRemote } from "next-mdx-remote/rsc";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";

import { blogMdxComponents } from "@/components/blog/blog-mdx-components";
import { requireAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { formatBlogDate } from "@/lib/blog/parse-post";
import { getBlogPost, listBlogPosts } from "@/lib/blog/posts";
import { SITE_NAME, SITE_URL } from "@/lib/site";

interface BlogPostPageProps {
  params: Promise<{
    locale: string;
    slug: string;
  }>;
}

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { locale: requestedLocale, slug } = await params;
  const locale = requireAppLocale(requestedLocale);
  const post = getBlogPost(slug, locale);

  if (!post) {
    return {};
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: `${post.date}T00:00:00.000Z`,
      url: `${SITE_URL}/${locale}/blog/${post.slug}`,
      siteName: SITE_NAME,
      images: [post.coverImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: BlogPostPageProps) {
  const { locale: requestedLocale, slug } = await params;
  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const post = getBlogPost(slug, locale);

  if (!post) {
    notFound();
  }

  const t = await getTranslations({
    locale,
    namespace: "Blog",
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-semibold text-primary">
        <Link href="/blog">{t("backToIndex")}</Link>
      </p>
      <p className="mt-6 text-sm font-medium text-ink-muted">
        <time dateTime={post.date}>
          {formatBlogDate(post.date, locale)}
        </time>
      </p>
      <h1 className="mt-3 text-4xl text-ink sm:text-5xl">{post.title}</h1>
      <p className="mt-5 text-lg leading-8 text-ink-muted">{post.excerpt}</p>
      <div className="relative mt-8 overflow-hidden rounded-xl border border-line">
        <Image
          src={post.coverImage}
          alt=""
          width={960}
          height={540}
          priority
          sizes="(max-width: 768px) 100vw, 720px"
          className="aspect-[16/9] w-full object-cover"
        />
      </div>
      <article className="mt-4">
        <MDXRemote
          source={post.content}
          components={blogMdxComponents}
        />
      </article>
    </main>
  );
}

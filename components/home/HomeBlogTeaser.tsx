import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getLatestBlogPosts } from "@/lib/blog/posts";

export function HomeBlogTeaser({
  locale,
  title,
  description,
  seeAllLabel,
}: {
  locale: AppLocale;
  title: string;
  description: string;
  seeAllLabel: string;
}) {
  const posts = getLatestBlogPosts(locale, 3);

  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl text-ink sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-xl text-ink-muted">{description}</p>
        </div>
        <Link
          href="/blog"
          className="hidden text-sm font-semibold text-primary sm:inline"
        >
          {seeAllLabel}
        </Link>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard
            key={post.slug}
            post={post}
            locale={locale}
          />
        ))}
      </div>
      <Link
        href="/blog"
        className="mt-6 inline-flex text-sm font-semibold text-primary sm:hidden"
      >
        {seeAllLabel}
      </Link>
    </section>
  );
}

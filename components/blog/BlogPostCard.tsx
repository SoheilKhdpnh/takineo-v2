import Image from "next/image";

import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import {
  formatBlogDate,
  type BlogPost,
} from "@/lib/blog/parse-post";

export function BlogPostCard({
  post,
  locale,
}: {
  post: BlogPost;
  locale: string;
}) {
  return (
    <Link href={`/blog/${post.slug}`} className="block h-full">
      <Card className="h-full">
        <div className="relative -mx-5 -mt-5 overflow-hidden sm:-mx-6 sm:-mt-6">
          <Image
            src={post.coverImage}
            alt=""
            width={960}
            height={540}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
            className="aspect-[16/9] w-full object-cover"
          />
        </div>
        <p className="mt-5 text-sm font-medium text-ink-muted">
          <time dateTime={post.date}>
            {formatBlogDate(post.date, locale)}
          </time>
        </p>
        <h3 className="mt-2 text-lg text-ink">{post.title}</h3>
        <p className="mt-2 text-sm leading-7 text-ink-muted">
          {post.excerpt}
        </p>
      </Card>
    </Link>
  );
}

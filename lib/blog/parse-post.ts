import { z } from "zod";

export const blogPostFrontmatterSchema = z.object({
  title: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "date must be YYYY-MM-DD",
  }),
  excerpt: z.string().min(1),
  coverImage: z.string().min(1),
  tags: z.array(z.string().min(1)).optional(),
  locale: z.enum(["en", "fa"]).optional(),
});

export type BlogPostFrontmatter = z.infer<
  typeof blogPostFrontmatterSchema
>;

export type BlogPost = BlogPostFrontmatter & {
  slug: string;
  content: string;
};

export function parseBlogPostSource(
  slug: string,
  raw: string,
  matter: (source: string) => { data: unknown; content: string },
): BlogPost {
  const parsed = matter(raw);
  const frontmatter = blogPostFrontmatterSchema.parse(parsed.data);

  return {
    slug,
    content: parsed.content.trim(),
    ...frontmatter,
  };
}

export function isBlogPostVisibleInLocale(
  post: Pick<BlogPost, "locale">,
  locale: string,
): boolean {
  return post.locale === undefined || post.locale === locale;
}

export function sortBlogPostsByDateDesc(
  posts: BlogPost[],
): BlogPost[] {
  return [...posts].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
}

export function formatBlogDate(
  date: string,
  locale: string,
): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(
    locale === "fa" ? "fa-IR" : "en-GB",
    {
      dateStyle: "long",
      timeZone: "UTC",
    },
  ).format(new Date(Date.UTC(year, month - 1, day)));
}

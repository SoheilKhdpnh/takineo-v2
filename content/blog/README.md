# Writing a Talkinu blog post

Posts are Markdown/MDX files in this folder. There is no CMS and no database. Adding a post is a file change.

## Add a post

1. Duplicate `_template.mdx`.
2. Rename the copy to a URL slug, for example `why-short-speaking-sessions.mdx`.
   The filename without `.mdx` becomes the URL: `/fa/blog/why-short-speaking-sessions`.
3. Fill in the frontmatter fields at the top.
4. Replace the body with your article.
5. Put a cover image in `public/images/blog/` and point `coverImage` at it.
6. Commit. The listing, post page, and homepage teaser pick up the new file automatically.

Do not start a filename with `_`. Those files are ignored (the template stays private).

## Frontmatter

| Field | Required | Example |
|---|---|---|
| `title` | yes | `"AI will not replace your English teacher"` |
| `date` | yes | `"2026-09-10"` (YYYY-MM-DD) |
| `excerpt` | yes | A short card summary |
| `coverImage` | yes | `"/images/blog/ai-assists.webp"` |
| `tags` | no | `[AI, speaking]` |
| `locale` | no | `en` or `fa`. Omit it to show the post in both languages. |

The body is the language you wrote. Chrome around the blog (page title, “See all posts”, dates) still follows the site locale.

## Cover images

Keep covers in `public/images/blog/`. Prefer WebP around 960px wide. Record the source and license in `docs/design/image-credits.md` when you add a new photograph.

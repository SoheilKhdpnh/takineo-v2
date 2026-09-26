# Talkinu image credits

All marketing photographs in this repository are original images generated for Talkinu in Cursor (`GenerateImage`). They are not scraped from search results, social media, or other websites.

Unsplash and Pexels were evaluated first. Direct CDN downloads from those hosts were blocked in this environment, so the permitted fallback — custom generated photography — was used instead.

| File | Use | Source | License |
|---|---|---|---|
| `public/images/home/hero-conversation.webp` | Homepage hero | Cursor GenerateImage, 2026-09-10, from `talkinu-hero-conversation.png` | Original work commissioned for Talkinu |
| `public/images/home/supporting-conversation.webp` | Homepage value-prop section | Cursor GenerateImage, 2026-09-10, from `talkinu-supporting-conversation.png` | Original work commissioned for Talkinu |
| `public/images/blog/fifteen-minutes.webp` | Blog cover | Cursor GenerateImage, 2026-09-10, from `talkinu-blog-speaking.webp` | Original work commissioned for Talkinu |
| `public/images/blog/ai-assists.webp` | Blog cover | Cursor GenerateImage, 2026-09-10, from `talkinu-blog-ai-teacher.webp` | Original work commissioned for Talkinu |
| `public/images/blog/session-feedback.webp` | Blog cover | Cursor GenerateImage, 2026-09-10, from `talkinu-blog-feedback.webp` | Original work commissioned for Talkinu |

WebP derivatives were created with `sharp` (quality 72, hero max 1400px, supporting max 960px) so Iranian mobile networks do not download oversized files. Next.js `Image` supplies responsive `srcset` on top of that.

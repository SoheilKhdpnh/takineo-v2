# Talkinu design system

Status: UI overhaul foundation  
Scope: Product interface on `feat/ui-overhaul`. Visual language only — booking, discovery, and authorization contracts are unchanged.

Talkinu is a Persian-first English-speaking marketplace. The interface should feel warm, trustworthy, and unhurried: closer to a calm studio than to a generic SaaS dashboard.

## Brand

Visible product name: **Talkinu**.  
Production domain: `https://talkinu.com`.

Internal identifiers, APIs, database fields, and logs remain English and may still say Takineo.

## Color

Tokens live in `app/globals.css` as Tailwind v4 theme colors.

| Token | Value | Use |
|---|---|---|
| `ink` | `#14221f` | Primary text. Meets WCAG AA on `canvas` and `surface`. |
| `ink-muted` | `#4d5f59` | Secondary text, captions, meta. |
| `canvas` | `#f4f0e8` | Page background. Warm paper, not cool gray. |
| `surface` | `#fffdf8` | Cards, sheets, inputs. |
| `primary` | `#0f6e66` | Primary actions, links, focus. Caspian teal. |
| `primary-hover` | `#0c5852` | Hover/active for primary. |
| `mint` | `#dceee9` | Soft fills, selected chips, trust bands. |
| `accent` | `#c96b2f` | Warm highlight for availability and emphasis. Never body text on white at small sizes. |
| `accent-soft` | `#f8e4d2` | Availability wells. |
| `line` | `#e6ddd0` | Borders and dividers. |
| `danger` | `#9f2d2d` | Errors and destructive actions. |

Do not invent one-off hex values in components. If a new color is required, add it here and in `globals.css` first.

Dark zinc marketing heroes are retired. Dark surfaces, when needed, use `ink`.

## Typography

Keep the existing pairing:

- English: Manrope Variable
- Persian: Vazirmatn Variable

Hierarchy:

| Role | Size | Weight | Notes |
|---|---|---|---|
| Display / hero | `text-4xl`–`text-6xl` | 680 | `text-wrap: balance`, display tracking. |
| Section heading | `text-2xl`–`text-3xl` | 680 | |
| Card title | `text-lg` | 650 | |
| Body | `text-base` (16px) | 420 | Line-height 1.7. |
| Meta / small | `text-sm` / `text-xs` | 500–600 | `ink-muted`. |

Do not introduce a third font family.

## Spacing and radius

- Page gutter: `px-4 sm:px-6`
- Section stack: `py-12 sm:py-16 lg:py-20`
- Card padding: `p-5 sm:p-6`
- Control height: `min-h-11` (44px) for primary hit targets
- Radius: `rounded-md` (14px) controls, `rounded-lg` (20px) cards, `rounded-xl` (28px) marketing panels

## Motion

No Framer Motion. CSS transitions only, and honor `prefers-reduced-motion`.

## Components

Reusable primitives live in `components/ui/`:

- `Button` — `primary`, `secondary`, `ghost`
- `Card`
- `Input`
- `Badge`
- `Avatar`
- `Rating` — display-only. Do not show ratings on teacher cards until the discovery API exposes them.

Marketplace pieces:

- `TeacherCard` — real discovery fields only (name, photo, headline, languages, experience, next available time). No invented price or stars.

## Accessibility

- Text on `canvas`/`surface` uses `ink` or `ink-muted`.
- Interactive controls have visible `:focus-visible` rings in `primary`.
- Images have alt text; avatar fallbacks use initials and `aria-hidden` when decorative.
- RTL is the default (`fa`). Do not hardcode left/right; use logical properties (`start`/`end`).

## Mobile and Iranian networks

- Mobile-first layouts; filters are a short chip row, not a desktop filter wall.
- Prefer server-rendered public pages.
- Do not add client JavaScript for static chrome.
- Teacher photos use sized `<img>` with `width`/`height`. Do not add unbounded remote `next/image` hosts until image origins are an explicit product decision.

## Content rules

Teacher cards and trust bands may only show facts the product actually has. There are no public ratings, prices, or testimonials in Wave 2. Do not fake them.

# Takineo

Takineo is a Persian-first English-learning platform centered on focused
15-minute speaking sessions with human teachers and AI-assisted feedback.

Human teachers teach. AI analyzes and assists. AI does not replace teachers.

## Current status

The project is under active development. The current foundation includes:

- Better Auth email/password authentication and protected database sessions
- Persian and English localized routes with RTL/LTR layouts
- student/teacher role onboarding
- student and teacher profile completion
- teacher application states and secure submission
- direct-to-Mux teacher introduction-video upload
- signed Mux webhook handling and provider-sync fallback

Administrative teacher review, availability, discovery, booking, speaking
sessions, AI analysis, learning reports, notifications, and production
hardening remain to be implemented.

Selecting the teacher product role creates a teacher applicant. It does not
make the user an approved or public teacher.

## Technology

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- next-intl
- Better Auth
- Prisma 7
- PostgreSQL / Neon
- Mux

## Requirements

- Node.js 24.x
- npm
- PostgreSQL/Neon development credentials
- Better Auth configuration
- Mux credentials for introduction-video development

Never commit environment files or secrets.

## Local development

Install dependencies:

```bash
npm ci
```

Configure the required environment variables in an uncommitted local
environment file. See [docs/database.md](docs/database.md) and
[docs/teacher-intro-video.md](docs/teacher-intro-video.md).

Generate Prisma Client and validate the schema:

```bash
npm run db:generate
npm run db:validate
```

Start the development server:

```bash
npm run dev
```

## Validation

The repository-wide validation command is:

```bash
npm run check
```

This generates Prisma Client, validates Prisma, runs ESLint and TypeScript, and
performs a production Next.js build. Automated test tooling is specified for
Wave 1 but is not installed yet.

## Documentation

Start with [AGENTS.md](AGENTS.md). Product, architecture, security, testing,
production-readiness, roadmap, and multi-agent contracts live under `docs/`.

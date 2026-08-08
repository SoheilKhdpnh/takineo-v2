# Takineo Architecture

## Architecture goals

Takineo should remain:

- understandable
- modular
- secure
- testable
- incrementally scalable
- operationally simple for a small team

Do not introduce distributed-system complexity before the product requires it.

## High-level architecture

```text
Browser
   │
   ▼
Next.js App Router
   │
   ├── Server Components
   ├── Client Components
   └── Route Handlers
           │
           ▼
      Auth / Policy
           │
           ▼
        Validation
           │
           ▼
       Service Layer
           │
           ├───────────────┐
           ▼               ▼
         Prisma      External Services
           │          Mux / future AI /
           ▼          future session provider
      PostgreSQL
        Neon
# Authorization

Takineo separates authentication from application authorization.

## Authentication

Better Auth establishes the identity of the signed-in user.

## Application roles

Takineo currently supports:

- `STUDENT`
- `TEACHER`

A newly registered user has no role until onboarding is complete.

## Profile invariants

A valid student user has:

- `User.role = STUDENT`
- one related `StudentProfile`
- no `TeacherProfile`

A valid teacher user has:

- `User.role = TEACHER`
- one related `TeacherProfile`
- no `StudentProfile`

## Role assignment

The browser submits only the chosen role.

The server derives the user ID from the authenticated session and
creates the role and corresponding profile inside one database
transaction.

Role fields are configured as server-owned Better Auth fields and
cannot be supplied during registration.

## Protected routes

Student routes are protected by:

- `app/student/layout.tsx`

Teacher routes are protected by:

- `app/teacher/layout.tsx`

Custom API routes must perform their own authentication and
authorization checks. Route protection must not rely only on browser
navigation, hidden links, or Proxy redirects.

## Teacher verification

Creating a teacher profile does not publish the teacher.

New teacher profiles begin with:

```text
applicationStatus = DRAFT
```

A teacher becomes publicly visible only once their application reaches:

```text
applicationStatus = APPROVED
```

The full lifecycle is:

```text
DRAFT → PENDING_REVIEW → APPROVED
                       → REJECTED
                       → SUSPENDED
```

- **DRAFT** — profile created, not yet submitted for review
- **PENDING_REVIEW** — submitted, awaiting admin review
- **APPROVED** — verified and publicly visible
- **REJECTED** — application declined
- **SUSPENDED** — previously approved, now withdrawn from public visibility
# Wave 4 AI Conversation Intelligence Contract

**Owner:** Wave 4 — AI Conversation Intelligence (`feat/wave4-ai-pipeline`)
**Canonical operational timezone:** `Asia/Tehran`
**Baseline:** `integration/wave2-final` (`12ebf3ad`)
**Upstream handoff:** `docs/engineering/wave2-domain-contract.md` §8, §17;
`docs/engineering/wave3-live-session-contract.md` §1, §2, §11
**Provider evaluation:** `docs/engineering/wave4-ai-provider-evaluation.md`
**Revision:** v3 — locks the 2026-09-13 §7 product decisions, pins
`Qwen2.5-7B-Instruct` Q4_K_M, and records the download-then-SCP weight path.
Supersedes v2 only for those previously open decisions.
**M1 status:** **APPROVED IN SUBSTANCE — implementation authorized.**

This is the canonical Wave 4 contract. It defines the pipeline that turns a
completed speaking session's audio into a transcript, corrections, vocabulary
intelligence, a fluency profile, weak points, and suggestions — and defines how
those combine with a teacher's professional judgement into a learning report.

`PRISMA SCHEMA-AFFECTING: NO` — for this document. The M2 migration is
schema-affecting and says so.

## 0. Wave numbering

`docs/agents/roadmap.md` lists the AI learning pipeline as Wave 5, because it
lists Teacher Discovery as Wave 3. Discovery shipped inside Wave 2 as Track B,
collapsing the numbering by one, and
`docs/engineering/wave3-live-session-contract.md` §0 already recorded that
collapse for live speaking.

The operative name for AI conversation intelligence is therefore **Wave 4**. This
renumbers nothing; it applies a collapse the roadmap already notes. Do not
renumber earlier waves to compensate.

## 1. Ownership boundary

Wave 4 **consumes** the booking and live-session models. It does not redefine
them.

Wave 4 must not:

- add, remove, rename, or retype any existing `SpeakingSession` column;
- extend, reorder, or reinterpret `SpeakingSessionStatus`;
- write `SpeakingSession.status` under any circumstance (§2);
- alter `SpeakingSessionCancellation`, availability, or discovery models;
- alter `SpeakingSessionLiveGrant` or `SpeakingSessionLiveEvent`, which Wave 3
  owns;
- weaken or replace any existing booking or live-session constraint, exclusion
  constraint, or partial unique index;
- modify `lib/domain/booking*.ts`, `lib/domain/live-session/**`,
  `lib/services/booking*.ts`, `lib/services/session-cancellation.service.ts`,
  `lib/services/speaking-session-read.service.ts`, or any Wave 3
  `lib/services/live-session-*.ts`;
- touch the Mux introduction-video surface (§12.1);
- touch LiveKit, egress, or VPS configuration, or `diagnostics/iran-webrtc/`.

Wave 4 **owns**, as an additive-only surface, the eleven models of §14, their
dedicated enums and relations, `lib/domain/session-analysis/**`, and Wave 4
services, validations, errors, ports, and routes.

Changing a Wave 2- or Wave 3-owned column, status, or transition is a contract
change escalated to the integration lead, never resolved inside a Wave 4
migration.

### 1.1 Reused existing types

`EnglishLevel` (`A1`–`C2`) already exists and is reused for every CEFR field.
Reuse is not modification: no member is added, removed, or reordered.
`AGENTS.md` and `lib/AGENTS.md` forbid duplicating existing helpers, so Wave 4
must not introduce a parallel CEFR enum.

`StudentProfile.englishLevel` is the student's declared level and is
**nullable**. §7.4 defines the fail-closed behaviour when it is absent; no code
may assume it is set.

## 2. Session status authority — Wave 4 never writes it

Wave 2 §8 forbids completing a session because `endAt <= now`. Wave 3 §2 makes
live-session evidence the only justification for the durable transition to
`COMPLETED`.

Wave 4 is downstream of both and has **read-only** access to session status.
Analysis is an observation about a session, never a cause of a state change in
it.

Consequences:

- Wave 4 services must never call Prisma `update`, `updateMany`, or raw mutation
  against `speaking_session`;
- a `SCHEDULED` session is not analyzable regardless of how much audio exists;
- a `CANCELLED` session is never analyzed, including retroactively after audio
  was captured;
- analysis success or failure never changes session status.

This is an executable invariant (§16), and the mirror image of Wave 3's boundary:
Wave 3 owns that write, Wave 4 owns none.

## 3. The three provenance layers

This section is the contract's spine. It comes before the output schema because
it constrains every table in it.

Three kinds of statement about a session are **different in kind**, not merely
different in wording, and must never be blended into one undifferentiated blob
of "feedback":

| Layer | Nature | Example |
|---|---|---|
| `AI_OBSERVATION` | a measured fact, bound to evidence in the transcript or audio | "The student used the wrong past tense 7 times." |
| `AI_RECOMMENDATION` | advice inferred from observations | "The student should practise past-simple storytelling." |
| `TEACHER_JUDGEMENT` | a human professional decision | "Focus on spontaneous storytelling next lesson." |

### 3.1 Separation is structural, not a flag

v1 of this contract carried a single `origin` column and was wrong. A flag can be
set incorrectly by one buggy insert, and it invites a future writer to "upgrade"
an AI row into a teacher row in place.

The separation is therefore enforced three ways at once:

1. **Different tables.** Observations, recommendations, and teacher judgement
   never share a table.
2. **A pinned `provenance` column.** Each table carries
   `provenance SpeakingSessionAnalysisProvenance`, fixed per table by a CHECK
   constraint, so a row cannot claim a layer its table does not represent.
3. **Immutability.** AI rows are **append-only and never mutated**. A teacher
   never overwrites, edits, or deletes an AI row.

`docs/agents/roadmap.md` requires that "AI results must remain distinguishable
from teacher-reviewed results". Immutability plus table separation satisfies that
structurally, which is strictly stronger than satisfying it with a boolean.

### 3.2 Observations must be falsifiable

An `AI_OBSERVATION` row must cite its evidence: a transcript segment index, a
quoted span, a count, or a measured duration. An observation that cannot be
traced back to the transcript or the audio is not an observation and must not be
persisted as one.

Prose that offers advice belongs in the recommendation layer. Prose that
characterizes the student in general terms with no evidence belongs nowhere.

### 3.3 The learning report is composed, not stored

```text
                 SESSION
                    │
             ┌──────┴──────┐
             │             │
          AI DATA       TEACHER
      (observations +   FEEDBACK
       recommendations)    │
             └──────┬──────┘
                    ▼
             LEARNING REPORT
```

There is deliberately **no `learning_report` table.** The report is a read model
composed at read time from the latest successful run's AI rows plus the session's
teacher feedback (§11.2).

Persisting a composed report would duplicate data that already exists, drift from
its sources, and — worst — flatten the three layers back into one document, which
is the exact thing §3.1 exists to prevent.

A published, immutable student-facing snapshot may eventually be wanted for
versioning. That is a separate decision, recorded in §18, and it would be a new
additive table rather than a mutation of these.

## 4. Input contract

### 4.1 Two per-role audio files

Wave 3 will run LiveKit egress so that **student and teacher speech arrive as two
separate recordings**, one per participant. Wave 4's input is that pair.

This is better than v1's single dual-channel file and materially better than a
mixed mono file, for reasons worth recording because they justify constraints
later in this document:

- **No diarization.** Speaker attribution is a property of which file a sample
  came from, not a probabilistic inference. Diarization errors would be
  attributed to the learner as vocabulary and weak points, so removing the stage
  removes a class of wrong feedback rather than reducing its rate.
- **No channel bleed.** The teacher's voice does not contaminate the student's
  track, so student word counts, speaking time, and pause measurement are clean.
- **Independent quality handling.** One track can fail or be missing without
  invalidating the other (§4.4).

```ts
type SessionAudioArtifactInput = {
  sessionId: string;
  participantRole: "STUDENT" | "TEACHER";
  source: "LIVE_EGRESS" | "SYNTHETIC_FIXTURE" | "OPERATOR_UPLOAD";
  storageProvider: "LOCAL_FILESYSTEM" | "S3_COMPATIBLE";
  storageBucket: string;       // logical container; directory for LOCAL_FILESYSTEM
  storageKey: string;          // opaque object key, never a public URL
  container: "OGG" | "MP4" | "MP3" | "WAV";
  durationMs: number;          // positive integer
  byteSize: number;            // positive integer
  contentSha256: string;       // lowercase hex, 64 chars
  capturedAt: Date;
};
```

`contentSha256` is load-bearing: it is the deduplication key (§13.1), part of the
transcript reuse key (§13.5), and the integrity check performed before bytes
reach an engine.

`participantRole` replaces v1's `channelLayout` and `studentChannel`. There is no
channel-splitting logic anywhere in Wave 4.

### 4.2 A run consumes a pair, not a file

`SpeakingSessionAnalysisRun` references artifacts explicitly:

- `studentAudioArtifactId` — **required**;
- `teacherAudioArtifactId` — nullable.

The student track is mandatory because the product analyzes the student. The
teacher track is optional because turn-taking and interaction metrics degrade
gracefully without it (§8.3) while everything else remains valid.

Both referenced artifacts must belong to the run's session, and their
`participantRole` must match the column they occupy. Both are database-enforced
(§14.1).

### 4.3 Eligibility — a pure predicate

Eligibility is a pure decision over a session snapshot, the artifact pair, and
existing run state. It decides; it never writes.

A `(session, artifactPair)` is analyzable only when all hold:

1. `session.status === "COMPLETED"`;
2. a `STUDENT` artifact exists for that session;
3. every referenced artifact belongs to that session with a matching role;
4. `durationMs` is within the configured plausibility band (§4.5);
5. no `SUCCEEDED` run exists for that artifact pair;
6. no non-terminal run exists for that session (§13.3).

Ineligibility reasons are typed values evaluated in exactly this order, so a
caller always receives one stable reason:

1. `SESSION_NOT_COMPLETED`;
2. `SESSION_CANCELLED` — terminal, checked before anything about the audio so a
   cancelled session yields a stable reason regardless of artifact state;
3. `STUDENT_AUDIO_MISSING`;
4. `ARTIFACT_NOT_FOR_SESSION`;
5. `ARTIFACT_ROLE_MISMATCH`;
6. `ARTIFACT_IMPLAUSIBLE_DURATION`;
7. `ALREADY_ANALYZED` — a `SUCCEEDED` run exists, so replay is idempotent rather
   than an error;
8. `RUN_IN_FLIGHT`.

Structural violations are programmer errors raising `RangeError`, per the Wave 3
§4 convention: an invalid `Date`, non-positive `durationMs`, blank storage key,
or mismatched session identity.

### 4.4 Degraded input is recorded, never guessed

A degraded run **succeeds** and records why. Silently emitting degraded output as
if it were clean is the failure this prevents.

```text
TEACHER_AUDIO_MISSING        turn-taking and interaction metrics are null
LOW_TRANSCRIPT_CONFIDENCE    mean student confidence below threshold
STUDENT_SPEECH_MINIMAL       too little student speech for reliable analysis
TRUNCATED_TRANSCRIPT         engine returned less than the audio duration
STUDENT_LEVEL_UNKNOWN        no declared level and no reliable estimate (§7.4)
OVERLAPPING_ERROR_CITATIONS  two error corrections claimed the same span and disagreed
```

### 4.5 Frozen input decisions

**Duration plausibility.** Sessions are exactly 15 minutes (Wave 2 §2), so
`durationMs` outside a configured `[minMs, maxMs]` band is rejected before any
engine runs. Like every Wave 4 policy value these bounds are **configuration with
no invented default**: absent, blank, or non-integer fails closed.

**Bytes never traverse the application server.** Route handlers must not proxy,
buffer, or stream audio, the same rule `AGENTS.md` imposes on Mux video. Workers
read through the storage port.

**Diarization is out of scope** (§4.1). Wave 4 never infers who spoke.

### 4.6 Trigger

Analysis is **pull-based**. Nothing about session completion implicitly starts an
AI job, which is what keeps Wave 3's completion path unmodified per §1.

Two server-side entry points:

1. **Artifact registration** — records that audio exists; idempotent; processes
   nothing by itself.
2. **Internal job** — `POST /api/internal/jobs/session-analysis` selects a
   bounded batch of eligible sessions and processes them.

The job route follows the existing pattern exactly, from
`app/api/internal/jobs/mux-playback-reconciliation/route.ts`: the
`x-takineo-job-secret` header compared with `timingSafeEqual`,
`getInternalJobSecret()` from `lib/env/internal-jobs`,
`INTERNAL_JOB_UNAUTHORIZED` on mismatch, `INTERNAL_JOB_NOT_CONFIGURED` when
unset, a Zod-bounded `limit`, `Cache-Control: private, no-store`, and an
operational-health payload able to report `DEGRADED`. Do not invent a second
job-authentication mechanism.

Pull-based also makes the pipeline restartable after an outage and keeps retry
policy in one place.

### 4.7 Synthetic input for development

No production recordings exist until both-participant opt-in — and a hard
guardian-consent gate for minor students — is captured. Final legal wording is
pending counsel (provider evaluation §7.1). Wave 4 is therefore still built and
tested against synthetic input, reusing the pattern that closed Wave 3 M3
against a fake provider adapter.

Required fixtures:

- **two deterministic generated WAV files**, one per role, produced by a
  committed script rather than committed binaries, with fixed sample rate,
  duration, and known checksums;
- `FakeTranscriptionEngine` — returns a canned deterministic transcript per
  fixture checksum, with configurable per-segment confidence so §7.5 and §8
  suppression are testable;
- `FakeAnalysisEngine` — returns canned schema-valid output, with injectable
  failure and malformed-output modes so §13 is testable;
- `LocalFilesystemAudioStorage` — the storage port over a temp directory.

The canonical fixture transcript is the integration lead's review example,
because it exercises a tense error, a preposition error, and a clean teacher turn
in three utterances:

```text
STUDENT  Yesterday I go to the university and I meet my friend.
TEACHER  What did you do there?
STUDENT  We discuss about our project.
```

Expected derived output for that fixture: two `GRAMMAR_ERROR` corrections
(`go` → `went`, `meet` → `met`), one `LEXICAL_ERROR` correction
(`discuss about` → `discussed` — the exchange is about yesterday, so the
collocation fix is the past form, not present `discuss`), and — under a
minimum-occurrence threshold of 2 — one `GRAMMAR`/`PAST_SIMPLE` weak point and
no preposition weak point from a single instance. That last expectation is the
point of the fixture: it proves §9.2 suppresses singleton patterns.

The whole pipeline must be provable end-to-end with no network, no GPU, no
provider account, and no live session. That is M3's acceptance bar.

## 5. Output layer 1 — transcript

The transcript is the foundation every other layer cites. It is stored as one
validated JSONB document per run rather than as rows: it is always read whole,
never queried relationally, and per-segment rows would be pure overhead.

```ts
type SessionTranscript = {
  schemaVersion: number;                 // starts at 1
  language: string;                      // BCP 47, e.g. "en"
  segments: TranscriptSegment[];         // merged, time-ordered
  studentWordCount: number;
  teacherWordCount: number | null;       // null when teacher audio absent
  studentSpeakingMs: number;
  teacherSpeakingMs: number | null;
  meanStudentConfidence: number | null;  // 0..1
  sources: TranscriptSource[];           // provenance and reuse keys
};

type TranscriptSegment = {
  index: number;                         // 0-based, dense, ascending by startMs
  speaker: "STUDENT" | "TEACHER";
  startMs: number;                       // relative to session start
  endMs: number;                         // > startMs
  text: string;
  confidence: number | null;             // 0..1, engine-reported
};

type TranscriptSource = {
  participantRole: "STUDENT" | "TEACHER";
  contentSha256: string;
  engine: string;                        // e.g. "whisper.cpp"
  model: string;                         // e.g. "large-v3-turbo"
  paramsHash: string;
};
```

Frozen decisions:

- **`speaker` is never `UNKNOWN`.** With per-role files (§4.1) attribution is
  known by construction. v1 had an `UNKNOWN` member for mixed audio; it is
  deliberately removed so no downstream code can treat attribution as uncertain.
- The two per-role transcriptions are **merged into one timeline** ordered by
  `startMs`, then `speaker` (`STUDENT` before `TEACHER`), then `index`, so
  ordering is total and deterministic.
- Timings are persisted as **integer milliseconds**. Display formatting such as
  `00:01:24 → 00:01:29` is a presentation concern; `AGENTS.md` forbids embedding
  localized formatting into persistence.
- `sources` records per-file engine and model identity, which is what makes
  transcript reuse (§13.5) sound and makes a result auditable against the model
  that produced it.
- `schemaVersion` is mandatory. An unversioned JSONB blob is unmigratable, and
  this one will change.

## 6. Output layer 2 — corrections

The system identifies **actual mistakes** rather than rewriting everything. An LLM
left unconstrained will rewrite every sentence to its preferred style, which
teaches nothing and buries real errors in noise.

```ts
type SessionCorrection = {
  id: string;
  runId: string;
  rank: number;                    // unique per run, presentation order
  provenance: "AI_OBSERVATION";
  type: "GRAMMAR_ERROR" | "LEXICAL_ERROR" | "NATURALNESS" | "OPTIONAL_IMPROVEMENT";
  subtype: string;                 // registry token, e.g. "PAST_SIMPLE"
  originalText: string;            // "Yesterday I go to the university."
  correctedText: string;           // "Yesterday I went to the university."
  explanation: string;             // why, in teachable terms
  transcriptSegmentIndex: number;
  charStart: number | null;        // span within the segment, for highlighting
  charEnd: number | null;
  confidence: number;              // 0..1
  weakPointId: string | null;      // set when aggregated into a pattern (§9)
};
```

### 6.1 The four types are not four shades of the same thing

| Type | Meaning | Counts as an error? |
|---|---|---|
| `GRAMMAR_ERROR` | violates a grammar rule | **yes** |
| `LEXICAL_ERROR` | wrong word or collocation, e.g. "discuss about" | **yes** |
| `NATURALNESS` | understandable but not how a native speaker phrases it | no |
| `OPTIONAL_IMPROVEMENT` | already correct; a stylistic alternative | no |

Frozen rules:

- **Only `GRAMMAR_ERROR` and `LEXICAL_ERROR` are errors.** They alone may be
  counted in error totals, feed weak-point aggregation (§9), influence severity,
  or justify a suggestion's rationale.
- `NATURALNESS` and `OPTIONAL_IMPROVEMENT` are **advisory** and are excluded from
  every count. A student must never be told they made 30 mistakes because a model
  preferred different phrasing 25 times.
- `OPTIONAL_IMPROVEMENT` is **capped per run** by configuration, failing closed
  when unset. The cap is the enforcement mechanism against rewrite-everything
  behaviour; without it the type merely relabels the noise rather than limiting
  it.
- A correction with `originalText === correctedText` is invalid and rejected. It
  is the signature of a model producing output because it was asked to, not
  because it found something.
- **Error corrections must cite exactly one distinct occurrence.**
  `GRAMMAR_ERROR` and `LEXICAL_ERROR` citations are split when `originalText` vs
  `correctedText` contains more than one contiguous edit (the Qwen probe's
  merged `go`+`meet` sentence), and rejected when the remaining citation cannot
  be uniquely located in the student segment. `NATURALNESS` and
  `OPTIONAL_IMPROVEMENT` are not split; they do not feed weak-point counts.
  This is enforced in `acceptCorrections`, the same way unknown subtypes map to
  `OTHER` and CEFR alternatives are filtered in code rather than by prompt
  wording. Identical repeats of the same span are dropped as duplicates.
  A later error that occupies the same span but disagrees on type, subtype, or
  corrected text is also dropped (first citation wins) and records the
  `OVERLAPPING_ERROR_CITATIONS` degradation so the conflict is visible.
- **Corrections may only target `STUDENT` segments.** Correcting the teacher is
  out of scope and would be a product defect; per-role input (§4.1) makes this
  trivially checkable, and §16 asserts it.

### 6.2 Subtypes come from a frozen registry

`subtype` is a stable screaming-snake token drawn from a registry in
`lib/domain/session-analysis/weak-point-registry.ts`, not free text from the
model.

An open-ended model-authored string would make two required things impossible:
aggregating grammar history across sessions, and localizing labels in
`messages/fa.json` and `messages/en.json`. Model output carrying an unrecognized
subtype is mapped to the registry's `OTHER` member and never persisted verbatim.
`OTHER` is a persistence fallback, not a pedagogical category: it is stored on
the correction and is exempt from ever becoming a weak point (§9.2).

The registry is the contract's controlled vocabulary. Adding a member is a normal
additive change; inventing one at runtime is not.

## 7. Output layer 3 — vocabulary intelligence

Two related but distinct things: what the student actually used, and what they
could have used instead.

```ts
type SessionVocabularyObservation = {
  id: string;
  runId: string;
  rank: number;                    // unique per run
  provenance: "AI_OBSERVATION";
  headword: string;                // <= 64 chars, normalized lowercase
  lemma: string | null;
  partOfSpeech:
    | "NOUN" | "VERB" | "ADJECTIVE" | "ADVERB" | "PRONOUN" | "PREPOSITION"
    | "CONJUNCTION" | "INTERJECTION" | "PHRASAL_VERB" | "COLLOCATION"
    | "IDIOM" | "OTHER";
  status: "USED_CORRECTLY" | "MISUSED" | "OVERUSED";
  occurrenceCount: number;                  // >= 1
  cefrLevel: EnglishLevel | null;           // level of the word as used
  studentUtteranceExcerpt: string | null;
  transcriptSegmentIndex: number | null;
  confidence: number;                       // 0..1
};

type SessionVocabularyAlternative = {
  id: string;
  observationId: string;           // parent word
  rank: number;                    // unique per observation
  provenance: "AI_RECOMMENDATION"; // note: a different layer from its parent
  suggestion: string;              // "effective"
  cefrLevel: EnglishLevel;         // required, and level-gated by §7.4
  exampleSentence: string | null;
};
```

### 7.1 Overuse is a first-class observation

A student saying `good` four times, `interesting` twice, and `nice` twice has a
lexical-range problem that no per-sentence grammar checker detects.
`OVERUSED` with `occurrenceCount` captures it, and the threshold above which
repetition becomes overuse is configuration, failing closed when unset.

### 7.2 Alternatives sit in the recommendation layer

Note that an observation and its alternatives occupy **different provenance
layers** (§3). "You said `good` four times" is a fact; "try `effective`" is
advice. They are joined by `observationId` but are separately typed and separately
attributable, which is exactly the distinction §3 requires.

### 7.3 The parent word is not the suggestion's level

`SessionVocabularyObservation.cefrLevel` describes the word the student used.
`SessionVocabularyAlternative.cefrLevel` describes the word being suggested. They
are different fields because they are different facts, and conflating them is how
level gating silently breaks.

### 7.4 Level gating — the frozen rule

**No alternative may exceed the student's working level by more than one CEFR
band.** With CEFR ordered `A1 < A2 < B1 < B2 < C1 < C2`:

```text
admissible ⇔ alternative.cefrLevel <= workingLevel + 1
```

This is an **intentional tightening** of the 2026-09-13 review's illustrative
table, not an accident and not a one-band misread of that table.

The review listed `big → significant, substantial` as `B2–C1`. Read as a student
jump, that is a **two-band** move (`B1 → C1`). The review's hard prohibition was
the four-band case — do not teach `substantial` to an A2 student who has not
mastered `large`. The table itself did not freeze a maximum jump.

Wave 4 freezes **+1 (i+1)** anyway, for three reasons:

1. A synonym one band above current level is a reachable stretch. Two bands is
   a different word family for most learners, which is how `substantial` lands
   on an A2 student even when the prompt said "B1–B2".
2. The review's own A2/C2 warning is the failure mode +1 prevents structurally:
   A2 + 1 = B1, so `effective` is admissible and `substantial` (C1) is not.
   Under a +2 cap, a B1 student would receive `substantial`; that is the row
   the table appeared to bless, and it is the row this rule rejects.
3. Same-level and −1 alternatives remain admissible. The cap is a ceiling, not
   a target. A B1 student may still be offered another B1 word.

**Disallowed by this rule, allowed by a loose reading of the review table:**

| Working level | Alternative | Alternative CEFR | +1 rule | Review table |
|---|---|---|---|---|
| A2 | effective | B1 | admissible | listed |
| A2 | substantial | C1 | **rejected** | would be the educational-AI disease |
| B1 | significant | B2 | admissible | listed as `B2–C1` |
| B1 | substantial | C1 | **rejected** | listed as `B2–C1` |
| B2 | substantial | C1 | admissible | listed |

The `B1 → substantial (C1)` cell is therefore **not an exception**. It is an
example the review used to illustrate richer vocabulary, and the frozen rule
does not allow it. Changing the cap to +2 is a contract change, not a tuning
knob.

The student's working level is resolved in this order:

1. `StudentProfile.englishLevel` when set;
2. otherwise the run's `overallLevelEstimate` when the estimator produced one;
3. otherwise **suppress all alternatives entirely** and record the
   `STUDENT_LEVEL_UNKNOWN` degradation (§4.4).

Step 3 is deliberate. `StudentProfile.englishLevel` is nullable (§1.1), and the
failure mode of guessing is recommending C1 vocabulary to a beginner. Silence is
the correct output when the level is unknown; a plausible guess is not.

Gating is enforced twice: in the domain rule that filters engine output, and by a
database CHECK on the alternative's `cefrLevel` against the `maxAllowedLevel`
written at insert time (working level + 1). Model output that violates it is
dropped, not persisted and flagged.

The +1 cap stays frozen. If a student needs exposure to higher-level vocabulary,
that is the teacher's call to make in the feedback section, not something the AI
suggests automatically. Widening the cap is a contract change.

## 8. Output layer 4 — fluency

Fluency uses **audio and timing information, not only the transcript**. It gets
its own table because it is a distinct family of observation and because its
metrics are wholly null when the underlying signal is unavailable.

```ts
type SessionFluencyProfile = {
  runId: string;                        // 1:1
  provenance: "AI_OBSERVATION";
  studentSpeakingMs: number;
  studentWordCount: number;
  studentWordsPerMinute: number;
  studentSpeakingRatio: number | null;  // needs teacher audio
  pauseCount: number;
  longPauseCount: number;
  meanPauseMs: number | null;
  longestPauseMs: number | null;
  fillerWordCount: number;
  fillerWordRate: number;               // per 100 student words
  selfCorrectionCount: number;
  repetitionCount: number;
  abandonedSentenceCount: number;
  turnCount: number | null;             // needs teacher audio
  meanStudentTurnMs: number | null;     // needs teacher audio
  narrativeFeedbackEn: string;
  narrativeFeedbackFa: string | null;
};
```

### 8.1 No opaque composite score

There is deliberately **no `fluencyScore` field**, and adding one is a contract
change.

"Your fluency is 72%" is not pedagogy. It is unfalsifiable, unactionable, and
invites students to optimize a number whose derivation nobody can explain. The
output is the measured metrics plus narrative feedback that interprets them:

> You communicate your ideas successfully, but your speech becomes less fluent
> when explaining unfamiliar topics. You also rely heavily on "um", "you know",
> and repeated sentence starts.

Percentages and composite indices are forbidden here. Individual raw metrics are
fine because each one is directly interpretable and directly checkable against
the audio.

### 8.2 A pause is silence while the student holds the floor

This is the subtlety that per-role audio makes both possible and necessary to get
right.

A gap in the student's track while **the teacher is speaking** is not a student
pause — it is normal conversation. Counting it would make every attentive listener
look disfluent, and would make students who interrupt look fluent.

Frozen rule: a student pause is silence in the student's track that is **not**
covered by teacher speech in the merged timeline. When teacher audio is absent,
pause metrics are computed from the student track alone and the
`TEACHER_AUDIO_MISSING` degradation is recorded, because the measurement is then
known to overcount.

The long-pause threshold is configuration and fails closed when unset.

### 8.3 Metrics that require both tracks

`studentSpeakingRatio`, `turnCount`, and `meanStudentTurnMs` are null when the
teacher artifact is absent. They are **null, not zero, and not estimated.** Zero
would be a false measurement, and an estimate would be an observation without
evidence, which §3.2 forbids.

## 9. Output layer 5 — weak points

A weak point is a **pattern across the whole conversation**, not a single
mistake. This is where the product stops correcting sentences and starts
identifying what the student needs to learn.

```ts
type SessionWeakPoint = {
  id: string;
  runId: string;
  rank: number;                    // unique per run
  provenance: "AI_OBSERVATION";
  category:
    | "GRAMMAR" | "VOCABULARY" | "PRONUNCIATION"
    | "FLUENCY" | "DISCOURSE" | "TASK_RESPONSE";
  subtype: string;                 // registry token, §6.2
  severity: "LOW" | "MEDIUM" | "HIGH";
  occurrenceCount: number;         // >= configured minimum
  confidence: number;              // 0..1; banded for display, §9.3
  explanation: string;
};
```

### 9.1 Examples are not duplicated onto the weak point

The evidence for a weak point is the set of corrections carrying its
`weakPointId` (§6). The instances shown under "Examples" in a report are read
through that relation.

Copying `originalText` strings onto the weak point would duplicate data that can
drift from its source, and would let a weak point cite an example that no
correction supports — an observation without evidence, which §3.2 forbids.

### 9.2 Patterns require repetition

A weak point requires **at least two linked error-typed corrections of the
same registry subtype**. That threshold is a **flat count of 2**. It does not
scale with session length, student word count, or utterance count.

```text
weak point ⇔ count(error-typed corrections with this subtype) >= 2
```

Production value, frozen:

```text
SESSION_ANALYSIS_WEAK_POINT_MIN_OCCURRENCES = 2
```

The env var still **fails closed when unset** — 2 is the product value, not a
hidden default the code may invent when configuration is missing.

Why flat, and why 2:

1. Every speaking session is already exactly 15 minutes (Wave 2 §2). A
   duration-scaled threshold would be a more complicated way of writing the
   same number.
2. Scaling with utterance or word count would punish students who talk more —
   the same two past-tense slips would vanish inside a talkative session and
   surface in a quiet one. The pedagogical question is "did this recur?", not
   "what fraction of turns contained it?".
3. One occurrence is a slip. Two of the same subtype in a single 15-minute
   conversation is a pattern the student needs to learn. That is the distinction
   the §4.7 fixture exists to prove: two `PAST_SIMPLE` errors become a weak
   point; one `PREPOSITION` error stays a correction and does not.

Only `GRAMMAR_ERROR` and `LEXICAL_ERROR` corrections count toward the two
(§6.1). `NATURALNESS` and `OPTIONAL_IMPROVEMENT` never do.

**`OTHER` is also exempt.** `resolveWeakPointSubtype` maps an unregistered model
token onto `OTHER` so free text never hits the database. Two such fallbacks are
not a pattern: they are two unrelated mistakes the model could not name, and
bundling them as `GRAMMAR`/`OTHER` would invent a weak point from coincidence.
An `OTHER` correction is stored and shown as a correction. It never receives a
`weakPointKey`, and it never increments a weak-point count.

A run may therefore legitimately contain corrections with no corresponding weak
point.

Changing the threshold from 2, or making it a function of session volume, is a
contract change.

### 9.3 Confidence is stored numerically, displayed as a band

`confidence` is a float so that thresholds and suppression are precise.
Presentation as `High` / `Medium` / `Low` is a read-model derivation with
documented cut points, not a second stored column, so there is one source of
truth.

### 9.4 Low-confidence evidence cannot create weak points

Per the provider evaluation §4.1, Whisper's error rate is materially higher for
lower-proficiency non-native speakers — precisely Takineo's students. A
transcription error and a learner error are indistinguishable downstream, so
presenting one as a weak point is actively harmful and would discredit the
feature.

Frozen rules:

- per-segment `confidence` is persisted, never discarded;
- a correction whose only evidence is a segment below the configured confidence
  threshold is not emitted;
- a `PRONUNCIATION` weak point additionally requires the threshold to be met,
  because low ASR confidence and mispronunciation are confounded;
- when mean student confidence is below the threshold the run still succeeds and
  records `LOW_TRANSCRIPT_CONFIDENCE`;
- the threshold is configuration and fails closed.

## 10. Output layer 6 — suggestions

Suggestions are the `AI_RECOMMENDATION` layer, and they must be **actionable**.
"Improve your grammar" is not a suggestion.

```ts
type SessionSuggestion = {
  id: string;
  runId: string;
  rank: number;                    // unique per run
  provenance: "AI_RECOMMENDATION";
  weakPointId: string | null;      // the observation this advice rests on
  priority: "HIGH" | "MEDIUM" | "LOW";
  kind:
    | "PRACTICE_DRILL" | "PHRASE_SUBSTITUTION" | "PRONUNCIATION_EXERCISE"
    | "HOMEWORK_TASK" | "RESOURCE";
  focus: string;                   // "Past simple vs present simple"
  rationale: string;               // "You made 7 past-tense errors this session."
  activity: string;                // "Describe yesterday using 10 past-tense verbs."
  targetDescription: string;       // "Fewer than 2 errors next session."
  targetSubtype: string | null;    // registry token the target measures
  targetMaxOccurrences: number | null;
  targetLevel: EnglishLevel | null;
  estimatedMinutes: number | null;
};
```

### 10.1 Advice must rest on evidence

`rationale` must be non-blank, and a suggestion must either link a `weakPointId`
or be explicitly general. General suggestions are **capped per run** by
configuration, failing closed, so a model cannot fill the report with
evidence-free advice.

This is §3.2 applied to the recommendation layer: an observation must cite
evidence, and a recommendation must cite an observation.

### 10.2 Targets are machine-checkable on purpose

`targetSubtype` and `targetMaxOccurrences` express "fewer than 2 past-tense
errors next session" in a form the **next** session's run can evaluate
automatically.

Wave 4 does not build progress tracking. It records targets in a shape that makes
progress tracking a query rather than a schema migration, which is the cheapest
possible provision for a roadmap requirement that is certainly coming.

## 11. Teacher judgement and the composed report

### 11.1 Teacher feedback

The AI does not replace the teacher. Human teachers teach; AI analyzes and
assists (`AGENTS.md`).

```ts
type SessionTeacherFeedback = {
  id: string;
  sessionId: string;               // unique: one per session
  authorUserId: string;            // must be the session's teacher
  provenance: "TEACHER_JUDGEMENT";
  body: string;                    // the teacher's own assessment
  focusNextSession: string | null; // "Focus on storytelling activities."
  createdAt: Date;
  updatedAt: Date;
};
```

Frozen rules:

- **the pipeline never writes this table.** No AI code path may insert, update, or
  delete teacher feedback, and §16 asserts it;
- only the session's own teacher may create or update the row, enforced
  server-side in the service layer; frontend visibility is not authorization;
- teacher feedback is **additive**: it never overwrites, edits, or deletes an AI
  row (§3.1);
- it is keyed to the **session**, not to an analysis run, because a teacher's
  professional judgement is about the lesson and must survive the audio being
  re-analyzed by a newer model.

That last rule is the reason this table hangs off `SpeakingSession` rather than
off a run, and it is worth stating explicitly: re-running analysis must never
orphan or invalidate something a human wrote.

### 11.2 Composition

`getSessionLearningReport(sessionId, actor)` composes, per §3.3:

1. the latest `SUCCEEDED` run for the session, deterministically ordered
   (§13.8);
2. its transcript, corrections, vocabulary observations with alternatives,
   fluency profile, weak points with linked correction evidence, and suggestions;
3. the session's teacher feedback, if any.

The three layers remain **separately identified in the returned shape** even
though a UI may render them together. A caller must always be able to tell
whether a statement is a measurement, a machine recommendation, or a teacher's
judgement.

No student-facing surface is built in Wave 4 (§15).

## 12. Storage

### 12.1 What already exists — checked, and it does not apply

The repository's only media provider is Mux, scoped entirely to the teacher
introduction video: `lib/video/mux-client.ts`, `lib/video/mux-config.ts`,
`lib/services/teacher-intro-video.service.ts`, `app/api/webhooks/mux/route.ts`,
`lib/services/mux-playback-reconciliation.service.ts`, and the reconciliation job
and script.

That is a 60–120 second marketing asset with moderation review and signed
playback. It has no live-session audio path and no consent basis for recording a
private lesson. Wave 4 must not extend it, and the provider evaluation §5 records
the second reason: expanding a U.S. provider dependency contradicts that
document's conclusion.

No other media storage, S3 client, or recording infrastructure exists anywhere in
the repository. Session audio storage is new work.

Two Mux **patterns** are adopted without the provider: bytes never traverse the
application server, and provider event processing is idempotent with a
reconciliation fallback for missed events.

### 12.2 Where audio lives

Behind a port, with no vendor SDK in pipeline logic:

```ts
type AudioStoragePort = {
  head(ref: AudioObjectRef): Promise<{ byteSize: number } | null>;
  openReadStream(ref: AudioObjectRef): Promise<ReadableStream<Uint8Array>>;
  delete(ref: AudioObjectRef): Promise<void>;
};
```

- development and tests: `LOCAL_FILESYSTEM`;
- production: `S3_COMPATIBLE`, target deferred to provider evaluation §5
  (self-hosted MinIO or ArvanCloud). An S3 API surface is required because Wave 3
  egress writes directly to any S3-compatible target, keeping the producer
  decoupled from this pipeline.

Rules:

- audio objects are **never public** and never served from a public URL;
- any signed URL is minted server-side, short-lived, and never returned to a
  client unauthorized for that session;
- storage credentials are server-only, never `NEXT_PUBLIC_*`;
- `contentSha256` is verified before bytes reach an engine; a mismatch fails the
  run as `AUDIO_UNREADABLE` rather than analyzing unverified input;
- raw audio is deleted 7–14 days after a **successful** analysis run
  (provider evaluation §7.2). `SESSION_AUDIO_RETENTION_DAYS` must be an
  integer in `[7, 14]` and fails closed if unset. Structured output stays.
  The port already exposes `delete`; the scheduler is a later job, not a
  redesign.

### 12.3 Where output lives

PostgreSQL, in the eleven Wave 4-owned tables of §14. Analysis output is
structured relational product data, not blobs.

## 13. Idempotency and retry

AI and transcription calls fail, time out, and need reprocessing. This is designed
in from the start.

### 13.1 Artifact registration is idempotent

- `@@unique([sessionId, participantRole, contentSha256])` — re-registering
  identical bytes for the same role returns the existing artifact;
- `@@unique([storageProvider, storageBucket, storageKey])` — two artifacts can
  never claim the same stored object;
- artifacts are **immutable**. Reprocessing creates a new run, never a mutated
  artifact.

### 13.2 Run creation is idempotent

- `@@unique([studentAudioArtifactId, requestIdempotencyKey])`;
- same key with the same logical request returns the existing run;
- same key with a different artifact pair raises a deterministic
  `AnalysisIdempotencyConflictError`;
- a replayed request never starts a second engine invocation.

### 13.3 At most one run in flight per session

A hand-written partial unique index, following Wave 2's
`speaking_session_teacher_active_slot_key` precedent:

```sql
CREATE UNIQUE INDEX ss_analysis_run_active_session_key
  ON speaking_session_analysis_run (session_id)
  WHERE status IN ('QUEUED', 'TRANSCRIBING', 'ANALYZING');
```

The database is the final authority on concurrent processing. Application checks
improve diagnostics; they are not the barrier. Two workers racing one session must
produce one run and one deterministic conflict, never two engine invocations and
two contradictory reports.

### 13.4 Run lifecycle

```text
QUEUED -> TRANSCRIBING -> ANALYZING -> SUCCEEDED
   \           \             \
    ----------- ------------- --> FAILED
    ----------- ------------- --> ABANDONED   (lease expiry only)
```

- every forward transition is a **compare-and-set** on current status, the
  mechanism Wave 3 uses for `SCHEDULED -> COMPLETED`;
- `SUCCEEDED`, `FAILED`, and `ABANDONED` are terminal and never mutated;
- runs are **append-only**; reprocessing inserts a new run with `attempt + 1`;
- a worker holds a lease: `leaseExpiresAt` plus `heartbeatAt`, renewed during long
  work;
- a crashed worker's run is reclaimed by an explicit transition to `ABANDONED`,
  vacating the §13.3 index and permitting a fresh attempt. Reaping is a deliberate
  transition, never a silent delete;
- `attempt` is bounded by configured `maxAttempts`, failing closed when unset.

### 13.5 Transcription is not repeated unnecessarily

Transcription is the expensive stage; an analysis-stage failure must not re-run it.

A new run may **adopt** a prior transcript when the reuse key matches exactly.
With two input files the key is the ordered pair:

```text
(studentContentSha256, teacherContentSha256 | null,
 transcriptionEngine, transcriptionModel, transcriptionParamsHash)
```

Adoption copies the transcript into the new run's own immutable row and records
`transcriptSourceRunId`, so runs stay self-contained and auditable while the
engine is not called twice for identical input.

Model and parameter identity are part of the key deliberately: the same audio
under a different model is a different transcript, and treating them as
interchangeable would silently mix outputs across model versions.

### 13.6 Output is written atomically

The transcript, report, fluency profile, corrections, vocabulary observations and
alternatives, weak points, suggestions, and the `ANALYZING -> SUCCEEDED`
transition are written in **one transaction**, guarded by compare-and-set on run
status.

Partial output must never be observable. A report with weak points but no
corrections because a worker died mid-write is worse than a failed run, because it
looks complete.

Ordering inside the transaction is fixed by referential dependency: corrections
are inserted before weak points are linked, and observations before alternatives.

### 13.7 Failure classification

Stable machine-readable codes, never parsed message strings (`AGENTS.md`,
`docs/engineering/conventions.md`):

```text
AUDIO_UNREADABLE                  terminal
AUDIO_TOO_SHORT                   terminal
STUDENT_AUDIO_MISSING             terminal
TRANSCRIPTION_ENGINE_UNAVAILABLE  retryable
TRANSCRIPTION_TIMEOUT             retryable
TRANSCRIPT_EMPTY                  terminal
ANALYSIS_ENGINE_UNAVAILABLE       retryable
ANALYSIS_TIMEOUT                  retryable
ANALYSIS_OUTPUT_INVALID           retryable, bounded
LEASE_EXPIRED                     retryable
INTERNAL                          terminal
```

`ANALYSIS_OUTPUT_INVALID` is retryable because schema-violating model output is
often transient, and bounded by `maxAttempts` so a persistently malformed model
cannot loop. Engine output is Zod-validated at the boundary before it is trusted:
model output is untrusted input like any other.

Database conflicts are classified by **constraint identity**, never message text,
per Wave 2 §12 and Wave 3's `lib/live-session/constraint-identity.ts`.

Internal failure detail is logged server-side and never returned to clients.

### 13.8 Determinism

Per Wave 2 §11, every ordered read has a total deterministic order:

- transcript segments: `startMs`, then `speaker`, then `index`;
- corrections: `rank`, then `id`;
- vocabulary observations: `rank`, then `headword`;
- alternatives within an observation: `rank`, then `suggestion`;
- weak points: `rank`, then `subtype`;
- suggestions: `rank`, then `id`;
- runs for a session: `createdAt` descending, then `id`;
- the current report: latest `SUCCEEDED` run by `finishedAt` descending, then
  `id`.

Never depend on incidental PostgreSQL row order.

## 14. Additive persistence surface

Eleven tables. v1 specified seven; the review's correction layer, split
vocabulary model, dedicated fluency profile, and teacher-judgement layer account
for the four additions. The count follows from §3's requirement that different
kinds of statement live in different tables.

All foreign keys to existing tables use `onDelete: Restrict`, consistent with the
booking and live-session models' history preservation.

| Model | Table | Layer | Key rules |
|---|---|---|---|
| `SpeakingSessionAudioArtifact` | `speaking_session_audio_artifact` | input | unique `(sessionId, participantRole, contentSha256)`; unique `(storageProvider, storageBucket, storageKey)` |
| `SpeakingSessionAnalysisRun` | `speaking_session_analysis_run` | control | unique `(studentAudioArtifactId, requestIdempotencyKey)`; partial unique in-flight index §13.3 |
| `SpeakingSessionTranscript` | `speaking_session_transcript` | observation | unique `runId` |
| `SpeakingSessionAnalysisReport` | `speaking_session_analysis_report` | observation | unique `runId` |
| `SpeakingSessionFluencyProfile` | `speaking_session_fluency_profile` | observation | unique `runId` |
| `SpeakingSessionCorrection` | `speaking_session_correction` | observation | unique `(runId, rank)`; nullable FK to weak point |
| `SpeakingSessionVocabularyObservation` | `speaking_session_vocabulary_observation` | observation | unique `(runId, headword)`; unique `(runId, rank)` |
| `SpeakingSessionVocabularyAlternative` | `speaking_session_vocabulary_alternative` | recommendation | unique `(observationId, rank)`; level CHECK §14.2 |
| `SpeakingSessionWeakPoint` | `speaking_session_weak_point` | observation | unique `(runId, rank)` |
| `SpeakingSessionSuggestion` | `speaking_session_suggestion` | recommendation | unique `(runId, rank)`; nullable FK to weak point |
| `SpeakingSessionTeacherFeedback` | `speaking_session_teacher_feedback` | teacher judgement | unique `sessionId`; FK `authorUserId` |

### 14.1 Artifact pairing is database-enforced

A run must not reference an artifact from another session, nor a teacher recording
in the student slot. Both are enforced by composite foreign keys rather than by
application checks alone.

`speaking_session_audio_artifact` carries a unique key on
`(id, session_id, participant_role)`. `speaking_session_analysis_run` carries two
stored generated columns fixing the expected role:

```sql
student_role  GENERATED ALWAYS AS ('STUDENT') STORED
teacher_role  GENERATED ALWAYS AS (
                CASE WHEN teacher_audio_artifact_id IS NULL
                     THEN NULL ELSE 'TEACHER' END) STORED
```

with composite foreign keys
`(student_audio_artifact_id, session_id, student_role)` and
`(teacher_audio_artifact_id, session_id, teacher_role)` referencing that unique
key. `MATCH SIMPLE` semantics leave the teacher key unenforced when the id is
null, which is the desired optional behaviour.

The effect is that a cross-session or wrong-role pairing is rejected by
PostgreSQL, not merely by a service. This is the same principle as Wave 2 §2: the
database is the final authority on relationships that must never be violated.

### 14.2 Declarative reach of the Prisma schema

Following Wave 3 §8.1: Prisma expresses plain unique keys, indexes, and
restrict-based foreign keys. It **cannot** express partial unique indexes, CHECK
constraints, generated columns, or composite foreign keys to non-primary unique
keys. These are hand-written SQL in the migration:

- `ss_analysis_run_active_session_key` — partial unique in-flight index (§13.3);
- `ss_analysis_run_artifact_pair_fk` / `ss_analysis_run_teacher_artifact_fk` —
  composite pairing keys and generated role columns (§14.1);
- `ss_analysis_run_terminal_shape_check` — `SUCCEEDED` and `FAILED` runs have
  `finishedAt`; `FAILED` runs have a `failureCode`; non-terminal runs have
  neither;
- `ss_audio_artifact_sha256_format_check` — 64-character lowercase hex;
- `ss_audio_artifact_positive_metrics_check` — positive `durationMs`, `byteSize`;
- `ss_correction_provenance_check`, `ss_weak_point_provenance_check`,
  `ss_vocabulary_observation_provenance_check`, `ss_fluency_provenance_check`,
  `ss_transcript_provenance_check`, `ss_report_provenance_check` — provenance
  pinned to `AI_OBSERVATION`;
- `ss_vocabulary_alternative_provenance_check`,
  `ss_suggestion_provenance_check` — pinned to `AI_RECOMMENDATION`;
- `ss_teacher_feedback_provenance_check` — pinned to `TEACHER_JUDGEMENT`;
- `ss_correction_distinct_text_check` — `original_text <> corrected_text` (§6.1);
- `ss_vocabulary_alternative_level_check` — `cefr_level <= max_allowed_level`,
  relying on the declaration order of `EnglishLevel` for enum ordering. The
  alternative row carries `max_allowed_level` computed at write time from §7.4's
  resolution, which is what makes the gate expressible as an immutable CHECK
  instead of a cross-table lookup;
- `ss_*_confidence_range_check` — confidence columns within `0..1`;
- `ss_suggestion_rationale_present_check` — non-blank `rationale` (§10.1).

Because these are hand-written, `prisma migrate diff` will **not** report their
absence as drift. A regression silently dropping one is detectable only by a test
asserting the constraint rejects a malformed row, so §16 carries those assertions
as executable invariants rather than review notes.

The canonical constraint names above are the stable identifiers error mapping keys
on.

### 14.3 Migration ordering and safety

- additive only: no existing column, type, index, or constraint is altered;
- the migration timestamp must sort **after** Wave 3's
  `20260823120000_add_live_session_evidence_foundation` so a combined integration
  applies in dependency order;
- additivity is verified **against the live database**, not inferred from the
  schema diff, exactly as Wave 3 M2 did: assert the nine `speaking_session`
  columns retain names, types, and nullability, and assert the pre-existing
  guards `speaking_session_exact_15m_check`,
  `speaking_session_start_grid_check`,
  `speaking_session_teacher_active_slot_key`,
  `speaking_session_student_active_slot_key`, and `tar_no_active_overlap` are
  still present. Two are partial unique indexes rather than constraints, so
  presence must be checked against `pg_class` as well as `pg_constraint`;
- `prisma migrate dev` must **not** be run: `prisma.config.ts` resolves the
  migration datasource from `DIRECT_URL`, pointing at the shared Neon development
  database, and it requires a shadow database the isolated test role cannot
  create. Use the CI path — override `DIRECT_URL` with the isolated test URL for
  the duration of a `prisma migrate deploy` — and do not let the override leak
  into the test run, because `getTestDatabaseUrl` rejects a `TEST_DATABASE_URL`
  sharing database identity with `DIRECT_URL`.

## 15. Security and privacy boundary

- every Wave 4 write path is server-side; frontend visibility is not
  authorization;
- analysis output for a session is readable only by that session's student, that
  session's teacher, and appropriately capable admin roles — enforced in the
  service layer, never in a component;
- only the session's own teacher may write teacher feedback (§11.1);
- audio is never public and never proxied through a route handler (§12.2);
- engine credentials, storage credentials, and the job secret are server-only;
- model output is untrusted input and is Zod-validated before persistence;
- raw engine responses, SQL, storage keys, and internal failure details are never
  exposed through public errors;
- **no student-facing surface is built in Wave 4.** When a student read path
  exists, it is **gated**: analysis rows are invisible to the student until a
  durable teacher-review mark is present. Labelling AI output is not enough
  (provider evaluation §7.3);
- recording requires explicit opt-in from both participants, plus guardian
  consent when the student is a minor. Legal copy is pending review. This
  **gates the first real recording** (provider evaluation §7.1);
- model upgrades apply to new runs only. Old sessions are never re-analyzed
  as a side effect of swapping weights (provider evaluation §7.5).

## 16. Executable invariant matrix

| Invariant | Expected evidence |
|---|---|
| eligibility is pure and never writes | unit test |
| frozen ineligibility precedence, one reason per case | unit test per reason |
| `SCHEDULED` session is never analyzed | unit test |
| `CANCELLED` session is never analyzed, even with audio | unit test |
| cancelled outranks artifact problems in precedence | unit test |
| structural violations raise `RangeError` | unit test |
| **Wave 4 never writes `speaking_session`** | Prisma spy test asserting no update/updateMany/raw |
| **pipeline never writes teacher feedback** | Prisma spy test |
| analysis failure does not change session status | service test |
| duration bounds, confidence threshold, minimum occurrences, caps, and `maxAttempts` all fail closed | unit env test per value |
| student audio required, teacher audio optional | service test |
| missing teacher audio nulls turn metrics and records degradation | service test |
| turn metrics are null, never zero or estimated | unit test |
| **student pause excludes teacher speech** | unit test with overlapping tracks |
| no `fluencyScore` field exists | schema/type test |
| **only GRAMMAR_ERROR and LEXICAL_ERROR count as errors** | unit test |
| `NATURALNESS` and `OPTIONAL_IMPROVEMENT` excluded from counts and weak points | unit test |
| `OPTIONAL_IMPROVEMENT` cap enforced | unit test |
| correction with identical original and corrected text rejected | integration test |
| **error corrections cite one occurrence; merged multi-site citations are split or rejected** | unit test |
| **conflicting overlapping error citations keep the first and record `OVERLAPPING_ERROR_CITATIONS`** | unit test |
| **corrections only target STUDENT segments** | unit test |
| unknown subtype maps to registry `OTHER`, never persisted verbatim | unit test |
| **`OTHER` corrections never receive a `weakPointKey` or form a weak point** | unit test |
| **weak point requires the minimum linked error corrections** | unit test |
| singleton error produces a correction but no weak point | fixture end-to-end test |
| weak point examples read through linked corrections, not copies | integration test |
| low-confidence segment yields no correction and no weak point | unit test |
| overuse detected with occurrence count above threshold | unit test |
| **no alternative exceeds the working level by more than one band** | unit test + DB CHECK test |
| unknown student level suppresses all alternatives and records degradation | unit test |
| observation and its alternatives carry different provenance | integration test |
| provenance is pinned per table by CHECK | integration test per table |
| AI rows are never mutated | integration test |
| teacher feedback survives re-analysis | integration test |
| suggestion rationale non-blank; general suggestions capped | unit test + DB CHECK test |
| identical bytes re-registered return the same artifact | integration test |
| two artifacts cannot claim one stored object | integration test |
| **cross-session artifact pairing rejected by the database** | integration test |
| **teacher recording in the student slot rejected by the database** | integration test |
| replayed run request returns the same run | integration test |
| same key, different pair conflicts deterministically | integration test |
| **at most one non-terminal run per session** | concurrent integration test |
| two racing workers produce one run and one conflict | concurrent integration test |
| lease expiry reclaims a run as `ABANDONED`, allowing retry | integration test |
| terminal run is never mutated | integration test |
| output written in one transaction, never partially visible | integration test with mid-write failure injection |
| retry after analysis failure reuses the transcript | service test asserting engine invoked once |
| reuse key covers both checksums and model identity | unit test |
| checksum mismatch fails the run without invoking an engine | service test |
| malformed engine output rejected by Zod, not persisted | service test |
| failure codes stable and classified retryable/terminal | unit test |
| DB conflicts classified by constraint identity, not message text | integration test |
| hand-written CHECK, generated-column, and partial unique constraints still installed | integration test |
| artifacts and analysis restrict destructive session deletion | integration test |
| Wave 2 booking columns and guards unchanged | catalog integration test |
| Wave 3 live tables unchanged | catalog integration test |
| deterministic ordering across every output relation | read test with tie cases |
| learning report keeps the three layers separately identified | service test |
| job route rejects missing or wrong secret; reports not-configured when unset | unit route tests |
| full pipeline runs offline against fixtures | end-to-end service test, no network |

## 17. Milestone sequence

### M1 — contract

**This document, revision v2.** Approved in substance by the integration lead's
2026-09-13 review.

### M2 — additive persistence

Prisma models and enums of §14 plus the hand-written SQL of §14.2. Review
generated SQL against §1 and §14 before applying. Prove uniqueness, the in-flight
partial index, the composite pairing keys, and every CHECK against a real
isolated PostgreSQL test database. Prove Wave 2 and Wave 3 surfaces unchanged
against the live database.

`PRISMA SCHEMA-AFFECTING: YES` — downstream tracks must then run
`npm run db:generate` and `npm run db:validate` and rerun typecheck and tests.

### M3 — pipeline against synthetic input

Ports, fakes, and fixtures of §4.7. Domain rules in
`lib/domain/session-analysis/**`, including the weak-point registry, the
correction taxonomy rules, level gating, and pause computation. Services for
artifact registration, run orchestration, lease management, reaping, and the
composed learning report. Teacher-feedback service with server-side
authorization. The internal job route of §4.6. Errors in
`lib/errors/session-analysis-errors.ts` with HTTP mapping in
`lib/errors/session-analysis-http.ts`, following the existing paired convention.

Acceptance: the full §16 matrix green, end-to-end with no network and no real
provider.

### M4 — real engine adapters

**M4 status: code-complete / execution-unverified.** Adapters, fail-closed env,
local-filesystem audio, and unit tests with injected process runners are in the
tree. This has not yet been proven against real `whisper-cli` / `llama-cli`
binaries or the pinned weights. Same distinction as the M2 migration before it
was applied to an isolated PostgreSQL database.

Self-hosting is locked. A `whisper.cpp` transcription adapter and a
`llama.cpp` adapter for `Qwen/Qwen2.5-7B-Instruct` Q4_K_M behind the same
ports, swapped in with no change to `assembleSessionAnalysis`. Weights arrive
by the download-then-SCP path in provider evaluation §9 onto a **separate
CPU-only Iranian VPS**, not the LiveKit contractor host.

Live speech never reaches a shell. `runCommand` uses `spawn(command, args)`
with `shell` unset. Whisper is given a temp WAV path via `-f`. The analysis
prompt is one `-p` argv element, not a concatenated command string.

The job route constructs engines through `createSessionAnalysisEngines()`.
Every engine path, model identity, timeout, and sampling bound **fails closed
when unset** — no invented binary or weight defaults.

| Variable | Meaning |
|---|---|
| `SESSION_ANALYSIS_AUDIO_ROOT` | local-filesystem storage root for per-role audio |
| `SESSION_ANALYSIS_WHISPER_BIN` | `whisper-cli` (or equivalent) executable |
| `SESSION_ANALYSIS_WHISPER_MODEL_PATH` | `ggml-large-v3-turbo.bin` |
| `SESSION_ANALYSIS_WHISPER_MODEL_ID` | recorded on transcript `sources.model` |
| `SESSION_ANALYSIS_WHISPER_TIMEOUT_MS` | transcription subprocess timeout |
| `SESSION_ANALYSIS_LLAMA_BIN` | `llama-cli` (or equivalent) executable |
| `SESSION_ANALYSIS_LLAMA_MODEL_PATH` | Q4_K_M shard 1; shard 2 must sit beside it |
| `SESSION_ANALYSIS_LLAMA_MODEL_ID` | recorded for audit, not a download URL |
| `SESSION_ANALYSIS_LLAMA_TIMEOUT_MS` | analysis subprocess timeout |
| `SESSION_ANALYSIS_LLAMA_N_CTX` | context window |
| `SESSION_ANALYSIS_LLAMA_N_GPU_LAYERS` | `0` on the CPU VPS |
| `SESSION_ANALYSIS_LLAMA_N_PREDICT` | max completion tokens |
| `SESSION_ANALYSIS_LLAMA_TEMPERATURE` | sampling temperature in `[0, 1]` |

`TranscriptionEnginePort.transcribe` receives SHA-256-verified audio bytes.
`AnalysisEnginePort.analyze` receives the per-role tracks and the declared
student level. `contentSha256` alone is not a transcript. Pipeline assembly
is unchanged.

### M5 — teacher-facing surface

Out of scope for this contract. Student visibility is already gated (§15);
the review UI that sets the durable mark is later work.

## 18. Out of scope for Wave 4

- speaker diarization (§4.1);
- realtime or in-session analysis; the pipeline is asynchronous and post-session;
- student-facing report UI and any publication workflow;
- a persisted, published learning-report snapshot (§3.3);
- the teacher review UI, and teacher acceptance or rejection of individual AI
  items;
- homework generation, vocabulary history, grammar history, and cross-session
  progress tracking — the schema is shaped to permit them (§10.2), and they are
  not built here;
- pronunciation scoring beyond what a confidence-bearing transcript supports;
- any change to Wave 2-owned booking columns, statuses, or transitions;
- any change to Wave 3-owned live-session models or services;
- LiveKit, TURN, egress, and VPS configuration, including
  `diagnostics/iran-webrtc/`;
- Skyroom and any webservice API integration;
- frontend visual design, the design system, and homepage content;
- consent-copy legal review and the capture UI that enforces §7.1;
- the audio-deletion scheduler that applies §7.2;
- provisioning the analysis VPS itself — Wave 4 does not touch the LiveKit
  contractor's host.

## 19. Prisma ownership and downstream communication

While Wave 4 is active, Wave 4 owns **only** the eleven additive tables of §14 and
their dedicated enums and relations. Booking-owned schema remains Wave 2
Track A's; live-session schema remains Wave 3's.

Ownership of `prisma/schema.prisma` was checked before claiming any: Wave 2
Track A owns booking models (`wave2-domain-contract.md` §16) and Wave 3 owns the
two live-session models (`wave3-live-session-contract.md` §12). Neither claims the
file exclusively, and neither claims anything Wave 4 adds. There is no ownership
conflict, but the textual merge point is shared, so the integration lead sequences
Wave 3's and Wave 4's migrations by timestamp (§14.3).

Every schema-affecting Wave 4 merge note must state either:

```text
PRISMA SCHEMA-AFFECTING: YES
```

or:

```text
PRISMA SCHEMA-AFFECTING: NO
```

For this contract document: **NO**.

Generated Prisma output is never a substitute for applying and reviewing the
canonical schema and migration, and stale generated types must not be trusted
across worktrees.



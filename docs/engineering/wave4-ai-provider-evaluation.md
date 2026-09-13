# Wave 4 AI / Speech Provider Evaluation

**Owner:** Wave 4 — AI Conversation Intelligence (`feat/wave4-ai-pipeline`)
**Baseline:** `integration/wave2-final` (`12ebf3ad`)
**Evidence gathered:** 2026-09-12
**Status:** **DECISION REQUESTED.** This document exists to be reviewed before any
integration code is written against a named provider. It recommends a default; it
does not lock one in.

This is the Wave 4 equivalent of the Wave 3 live-provider reachability work
(`docs/engineering/wave3-live-session-contract.md` §13). Wave 3 lost time because
provider eligibility was tested late. The same question is asked here first.

## 0. What question is actually being asked

Wave 3 established that two independent things must both hold before a provider
can be trusted:

1. **Reachability** — can traffic actually complete from the network we run on?
2. **Eligibility** — does the provider's own contract permit an Iranian account,
   an Iranian owner, or an Iranian billing relationship at all?

Failing (2) is worse than failing (1). A network problem is an engineering
problem. An eligibility problem is a business-continuity problem that surfaces as
sudden account termination, usually after the integration is already load-bearing.

Wave 4 has a third question that Wave 3 did not:

3. **Data residency and consent** — session audio is a recording of two
   identified people talking. Shipping it to a third party is a privacy decision,
   not only a procurement decision. See §7.

## 1. Method and the strength of this evidence

Each provider's published terms of service, supported-country list, and export
control clause were read directly on 2026-09-12. Findings below quote those
documents.

Two honest limits on this evidence:

- **No signup was attempted.** Published terms are the provider's stated policy.
  They are strong evidence of *contractual* eligibility and weak evidence of what
  a specific payment instrument will do at checkout. Wave 3 learned the reverse
  case too: Netlify's terms were not the blocker, its signup flow was.
- **Terms change.** Anthropic tightened its regional rule to cover *ownership*,
  not just location, after this project started. Any provider marked usable below
  must be re-verified at the moment of adoption, not trusted from this document.

Provider policy is therefore treated as a moving hazard, and the recommendation in
§6 is chosen specifically to not depend on it.

## 2. What U.S. law actually says (this is narrower than expected)

This matters because it separates "illegal" from "vendor says no", and those two
have very different mitigations.

OFAC's Iranian Transactions and Sanctions Regulations carry a general license at
[31 CFR § 560.540](https://ofac.treasury.gov/media/928096/download?inline=) which
**authorizes** exporting to Iran:

- "fee-based or no-cost services incident to the exchange of communications over
  the Internet", with the enumerated examples explicitly including
  **"e-learning platforms"** and "cloud-based services in support of the
  foregoing";
- software incident to those services that is designated `EAR99` or classified
  `ECCN 5D992.c`.

OFAC confirms this directly in
[FAQ 441](https://ofac.treasury.gov/faqs/topic/1611): fee-based cloud computing
services supporting internet communications *are* authorized for Iran.

Two conclusions follow, and they point in opposite directions:

1. **Takineo's own product category is squarely inside the general license.** An
   Iranian-operated e-learning platform running open-source software is not the
   thing the sanctions regime is aimed at. Self-hosting open-weight models is
   clean, not a loophole.
2. **None of that obliges a vendor to serve us.** Every provider below imposes
   restrictions *stricter* than the general license requires, as a matter of risk
   appetite. They enforce those restrictions by blocking IPs and terminating
   accounts, and there is no forum in which "but General License D-2 permits
   this" gets an account reinstated.

So the legal analysis does not rescue any restricted provider. It only tells us
the self-hosted path has no sanctions question at all.

## 3. Restricted providers

### 3.1 OpenAI (Whisper API, GPT models) — **BLOCKED**

The obvious default is the clearest failure.

- Iran is **absent** from
  [OpenAI's supported countries and territories](https://developers.openai.com/api/docs/supported-countries).
  The list is an allowlist by construction: *"We do not publish a separate list
  of countries and territories that we do not support. If a location is not
  included in the list below, our API is not supported there."*
  Note that Iraq, Turkey, Turkmenistan, Azerbaijan, and Armenia are all listed.
  Iran's omission is deliberate, not an oversight.
- *"Accessing or offering access to our services outside of the countries and
  territories listed below may result in your account being blocked or
  suspended."*
- Payment is separately fatal:
  [*"Using payment methods outside of our list of supported countries will result
  in you being blocked from using our services."*](https://help.openai.com/en/articles/9131992-chatgpt-and-api-services-in-unsupported-countries-and-territories)
- This is actively enforced, not dormant policy. OpenAI notified developers that
  from 2024-07-09 it would take *"additional measures to block API traffic from
  regions that are not on our supported countries and territories list"*, with
  Iran named in the reporting
  ([PCMag](https://www.pcmag.com/news/openai-to-clamp-down-on-access-for-users-in-china-unsupported-regions),
  [Caixin](https://www.caixinglobal.com/2024-06-26/openai-enforces-harsher-api-restrictions-on-unsupported-countries-102209858.html)).

**Verdict:** unusable. Both the account relationship and the payment rail are
closed, and enforcement is deliberate. A VPN or foreign-fronted account is
account-termination risk placed underneath the product's core value proposition.

Note the important distinction that §4.1 depends on: **this restriction attaches
to OpenAI's hosted API, not to the Whisper model.** The open-source Whisper
weights are MIT-licensed and carry no such condition.

### 3.2 Anthropic (Claude) — **BLOCKED, and worse than the others**

- Iran is absent from
  [Anthropic's supported countries and regions](https://www.anthropic.com/supported-countries).
  As with OpenAI, Iraq and Türkiye are listed; Iran is not.
- Anthropic goes further than location. It
  [reserves the right](https://www.anthropic.com/supported-countries) to refuse
  service to *"entities whose majority direct or indirect ownership is
  attributable to nations other than those listed"*, and its
  [2025 policy update](https://www.anthropic.com/news/updating-restrictions-of-sales-to-unsupported-regions)
  extends the prohibition to organizations *"more than 50% owned, directly or
  indirectly, by companies headquartered in unsupported regions"* — explicitly
  targeting access "through subsidiaries incorporated in other countries".

**Verdict:** unusable, and structurally so. This is the one provider where even
the common mitigation — incorporate outside Iran and bill from there — is
contractually pre-empted. Worth internalizing as the general shape of the risk:
the trend in vendor policy is from *IP-based* to *ownership-based* restriction.

### 3.3 Google Cloud (Speech-to-Text, Gemini) — **BLOCKED**

- Google's own onboarding documentation lists
  [prohibited territories](https://cloud.google.com/startup/onboarding):
  *"Google restricts access to some of its services in certain countries or
  regions, such as China, Crimea, Cuba, **Iran**, North Korea, and Syria."*
- [Google Cloud's terms](https://cloud.google.com/terms) bind the customer to
  OFAC sanctions and the EAR, and billing country must match the billing address.

**Verdict:** unusable. Same class as OpenAI, with the added friction that Google
account-level enforcement tends to affect adjacent Google services.

### 3.4 ElevenLabs — **BLOCKED, explicitly by name**

- Its help center is unusually direct:
  [*"We are required to restrict access from the following countries: Belarus,
  Cuba, **Iran**, North Korea, Russia, Syria..."*](https://help.elevenlabs.io/hc/en-us/articles/22497891312401-Do-you-restrict-access-to-the-service-and-platform-for-any-specific-countries)
  *"If you are connecting from one of these sanctioned countries, your access to
  our service will be blocked."*
- The same page contains a warning that is directly relevant to our VPS plan:
  *"Some servers may be impacted by this block even if they are not physically
  located in one of the affected regions, as our cloud provider might flag them
  as associated with one of these countries."*
- [Its terms](https://elevenlabs.io/terms-of-use) require the user to warrant they
  are not located in Iran.

**Verdict:** unusable. Recorded here mainly for the second bullet: routing
through a foreign VPS does not reliably launder provider-side geo-blocking, which
undermines the whole "just proxy it" mitigation for every provider in this
section.

### 3.5 Deepgram — **BLOCKED**

[Deepgram's terms](https://deepgram.com/terms) §14 require that the customer is
not *"a national or resident of, or a segment of the government of, any country
or territory for which the United States maintains trade and economic sanctions
or embargoes"*, and extend the same test to any person owning 50% or more of the
customer's equity.

**Verdict:** unusable. No country list is published, but "national or resident
of" an embargoed country is unambiguous as applied to Iran, and the 50%-ownership
clause replicates Anthropic's structural problem.

### 3.6 AssemblyAI — **UNUSABLE IN PRACTICE (ambiguous, which is its own risk)**

[AssemblyAI's terms](https://www.assemblyai.com/legal/terms-of-service) §9.10
contains only a generic export-control clause — the customer must not make the
services "accessible from any jurisdiction or country to which export, re-export,
or release is prohibited by law" — with no country list and no residency warranty.

**Verdict:** do not adopt. Absence of an explicit ban is not permission. An
undocumented policy is *harder* to plan around than a documented one, because
enforcement arrives as a surprise rather than as a term you read up front. The
payment rail also remains unsolved regardless.

### 3.7 Mistral AI (EU) — **BLOCKED. This is the important negative result**

The intuitive mitigation — "use a European vendor, EU sanctions on Iran are
narrower than U.S. sanctions" — does not work.

- [Mistral's commercial terms](https://legal.mistral.ai/terms/commercial-terms-of-service)
  §14.13 require the customer to warrant that neither it nor its personnel are
  *"located in or organized under the laws of any country or region subject to
  comprehensive sanctions or embargoes by the European Union, United States, or
  Singapore (including, as of the Effective Date, Cuba, **Iran**, North Korea,
  Syria...)"*. The
  [rest-of-world consumer terms](https://legal.mistral.ai/terms/row-consumer-terms)
  carry the same warranty.
- Separately, effective 2026-08-05, Mistral restricted API and Studio access to
  business customers only, removing personal-account API access.

**Verdict:** unusable. A French company voluntarily binds itself to U.S. sanctions
and names Iran. Generalize this: **vendor jurisdiction is not a reliable proxy for
vendor eligibility.** Any commercial LLM vendor with U.S. investors, U.S. cloud
dependencies, or U.S. market ambitions should be assumed to adopt U.S.-style
restrictions regardless of where it is incorporated. Screening candidates by
headquarters country is not a strategy.

### 3.8 Summary of restricted providers

| Provider | Iran named? | Ownership clause? | Payment blocked? | Verdict |
|---|---|---|---|---|
| OpenAI | absent from allowlist | no | yes, explicitly | blocked |
| Anthropic | absent from allowlist | **yes, >50% indirect** | n/a | blocked, structurally |
| Google Cloud | **yes, by name** | no | billing-address bound | blocked |
| ElevenLabs | **yes, by name** | no | n/a | blocked, IP-enforced |
| Deepgram | embargo test | **yes, 50% equity** | n/a | blocked |
| AssemblyAI | no clause | no | unsolved | do not adopt (opaque) |
| Mistral (FR) | **yes, by name** | organized-under test | business-only | blocked |

Zero of the seven mainstream candidates is usable. This is a stronger and more
uniform result than Wave 3 found for live video, where self-hosting a vendor's
open-source server was still an option. Here, even that is unnecessary: the
models themselves are available.

## 4. The self-hosted path

### 4.1 Transcription — self-hosted Whisper

Whisper's **code and weights are MIT-licensed**
([LICENSE](https://github.com/openai/whisper/blob/main/LICENSE)): permission "to
deal in the Software without restriction", subject only to retaining the
copyright notice. There is no field-of-use restriction, no geographic
restriction, no account, no billing relationship, and no acceptable-use policy
that can be revoked. The sanctions question does not merely become manageable —
it ceases to exist, exactly as self-hosting the media server did for Wave 3.

OpenAI's model card does ask users not to transcribe people without consent; that
is an ethical request, not a licence condition, and it lands on §7 rather than
here.

Two runtimes are mature. They are complements, not competitors:

| | `faster-whisper` (CTranslate2) | `whisper.cpp` |
|---|---|---|
| Language | Python | C/C++, no Python dependency |
| GPU | CUDA only | CUDA, Metal, Vulkan |
| Best for | NVIDIA GPU servers, Python pipelines | CPU-only, Apple Silicon, AMD, dependency-free |

Measured cost, from the
[faster-whisper benchmark](https://github.com/SYSTRAN/faster-whisper) (13 minutes
of audio, RTX 3070 Ti):

| Model / precision | Time for 13 min | VRAM |
|---|---|---|
| `large-v3-turbo` fp16 | ~19 s | ~2.5 GB |
| `large-v3-turbo` int8 | ~20 s | **~1.5 GB** |
| `large-v2` int8 | 59 s | 2.9 GB |
| `large-v2` int8, batch 8 | 16 s | 4.5 GB |
| `large-v3` fp16 (reference) | 143 s | 4.5 GB |

This is the decisive practical finding: **a 15-minute Takineo session transcribes
in roughly 20–25 seconds inside 1.5–2.5 GB of VRAM.** Takineo's workload is a
handful of short, bounded, non-realtime jobs — not a streaming service. It fits
on the smallest GPU worth renting, and `whisper.cpp` on CPU is a viable fallback
for low volume at roughly 2–3× real-time for a 15-minute file. No specialized
infrastructure is required, and the analysis is asynchronous, so latency is not
user-facing.

`large-v3-turbo` (809M params, 4 decoder layers) is the recommended starting
model: it is the fastest and smallest of the large family while scoring at or
better than `large-v3` on the cited clean-speech benchmarks.

**Accuracy caveat, and it is a product risk rather than a footnote.** Whisper's
error rate is materially higher for exactly Takineo's speakers. Peer-reviewed
evaluation across accents
([JASA, 2024](https://doi.org/10.1121/10.0024876);
[preprint](https://www.repository.cam.ac.uk/bitstreams/4ef0ef50-0f8a-4325-82bf-7e333cb23565/download))
finds significantly higher error for non-native accents, for **lower English
proficiency**, and for conversational rather than read speech; more English
experience correlates with lower error. OpenAI's own model card concedes
"disparate performance on different accents and dialects". Published WERs of
2–8% come from clean read English and **must not be assumed** for a beginner
Persian-L1 learner on a live call.

The consequence for design, carried into the contract: a transcription error and
a learner error are indistinguishable downstream. An ASR mistake presented to a
student as "your weak point" is worse than no feedback, and it is precisely the
failure mode that would discredit the feature. This forces three requirements
into `wave4-ai-pipeline-contract.md`: per-segment confidence must be persisted,
low-confidence spans must not become weak points, and AI output must stay
teacher-reviewable rather than student-facing by default.

### 4.2 Analysis — self-hosted open-weight LLM

Transcription alone does not produce vocabulary lists, weak points, or
suggestions. That step needs a language model, and it must be self-hostable under
a licence with no geography clause.

| Family | Licence | Geographic restriction | Suitability |
|---|---|---|---|
| Qwen3 open variants (e.g. 27B dense) | **Apache 2.0** | none | **recommended** |
| Mistral Large 3 open weights | **Apache 2.0** | none in the weight licence | usable |
| Qwen flagship "Max" | bespoke | none, but MaaS revenue gate | avoid needlessly |
| Llama 4 | Meta Community License | MAU cap; EU carve-out on multimodal | avoid |
| Gemma | Google terms | vendor AUP attaches | avoid |

Recommendation: an **Apache 2.0** checkpoint. Apache 2.0 is a licence, not a
service, so there is no counterparty who can decide next quarter that Iran is
unsupported — which is the entire point of this exercise. Note the trap the table
records: Qwen's *small* models are Apache 2.0 while its flagship carries a
bespoke licence with revenue thresholds, so the family name is not sufficient
and the specific checkpoint must be pinned and its licence read.

Sizing is not yet decided and does not need to be. Wave 4's analysis prompt runs
once per completed 15-minute session over a ~2,000-word transcript. That is a
small, latency-tolerant batch job, and a mid-size instruct model on the same GPU
that serves Whisper is a plausible starting point.

### 4.3 Where this actually runs — deliberately not decided here

Wave 4 needs GPU or CPU compute and object storage. The VPS provisioning work is
currently with a third-party contractor and **is explicitly out of scope for this
document**; nothing here should be read as a request to touch it.

What the contract does require is that Wave 4 code depend on an *interface*, not
a host: a transcription engine port, an analysis engine port, and an
S3-compatible storage port. Phase 2 is built and fully tested against fakes, so
the hosting decision can be made later without touching pipeline logic. Wave 3
proved this works — its M3 services closed against a fake provider adapter with
vendor selection still open.

## 5. Storage — what already exists, and what does not

Checked before assuming anything needed building, per the task's instruction.

**Mux is not relevant to session audio.** The Mux integration
(`lib/video/mux-client.ts`, `lib/video/mux-config.ts`,
`lib/services/teacher-intro-video.service.ts`,
`app/api/webhooks/mux/route.ts`,
`lib/services/mux-playback-reconciliation.service.ts`) is scoped entirely to the
60–120 second **teacher introduction video**: direct browser upload, moderation
review with signed playback, and a reconciliation job for missed webhooks. It is
video-on-demand for a teacher's marketing asset. It has no connection to live
speaking sessions, no audio-recording path, and no participant-consent basis for
recording a private lesson. Reusing it here would also *expand* an existing U.S.
provider dependency in precisely the direction this document argues against.

Two things are worth borrowing from it, and they are patterns rather than code:
bytes never pass through the application server, and webhook processing is
idempotent with a provider-sync fallback for missed events.

**There is no other media storage.** No S3 client, no object-storage
configuration, and no recording infrastructure exists anywhere in the repository.
Session audio storage is genuinely new work.

**Recommended target: S3-compatible object storage, chosen later.** LiveKit's
Egress can write a mixed audio-only recording directly to
[any S3-compatible provider](https://docs.livekit.io/transport/media/ingress-egress/egress/outputs.md)
(`force_path_style: true` for non-AWS), so an S3 API surface keeps the eventual
producer and the pipeline decoupled. Credible candidates, all deferred:

- **self-hosted MinIO** — no new account relationship, no sanctions question,
  full control; the natural match to the self-hosted posture;
- **ArvanCloud Object Storage** — Iranian, S3-compatible
  (`s3.ir-thr-at1.arvanstorage.ir`, path-style, rial billing, supported by
  rclone and s3cmd), keeping audio in-country with no foreign counterparty.

For Phase 2, neither is needed: development and tests use a local filesystem
adapter behind the storage port.

**One input-shape finding that affects analysis quality more than model choice.**
LiveKit Egress can emit either a single mixed mono file or, with
`audio_mixing` set to dual-channel, separated channels
([egress API](https://docs.livekit.io/reference/other/egress/api/)). Mixed mono
audio would force speaker diarization to work out which words the *student* said
— an error-prone extra stage whose mistakes would be attributed to the learner as
vocabulary and weak points. The contract therefore requires speaker-separated
audio as the supported input, and treats mono as an explicitly degraded mode.
Deciding this now costs nothing; discovering it after building the analysis
prompt would cost a rewrite.

## 6. Recommendation

**Self-host both stages. Do not integrate any commercial AI provider.**

1. **Transcription:** Whisper `large-v3-turbo`, MIT-licensed weights, via
   `faster-whisper` on CUDA or `whisper.cpp` on CPU.
2. **Analysis:** an Apache 2.0 open-weight instruct model, checkpoint pinned and
   licence verified at adoption.
3. **Storage:** S3-compatible; self-hosted MinIO or ArvanCloud; local filesystem
   adapter for development and tests.
4. **Code:** depend on ports, never on a vendor SDK, so §4.3 stays deferrable.

Reasoning, in order of weight:

- **Every commercial option is closed.** Not "risky" — seven for seven either
  name Iran or exclude it from an allowlist. There is no restricted-provider
  gamble to evaluate, so the usual "move fast now, migrate later" trade does not
  apply.
- **Self-hosting removes the category of risk rather than mitigating it.** MIT
  and Apache 2.0 grants cannot be revoked by a policy update, and OFAC's general
  license (§2) already covers this software class, so there is no residual
  compliance exposure to manage.
- **The workload is small enough that self-hosting is cheap.** ~20 seconds and
  ~1.5 GB VRAM per 15-minute session (§4.1). The usual objection to self-hosted
  inference — that managed APIs are cheaper at low volume — is weak here because
  the volume is low *and* bounded, and the job is asynchronous.
- **It is the same decision Wave 3 already made** for the media server, for the
  same reason, which keeps the operational story coherent instead of splitting
  the product across two opposed procurement postures.

Accepted costs, stated plainly: we own model hosting, capacity, upgrades, and
output quality, and we give up frontier-model analysis quality. The quality gap
is tolerable because §7 keeps a human teacher between AI output and the student —
which the product already requires for reasons unrelated to sanctions.

### 6.1 Cost — zero licence cost, and no GPU is strictly required

The recommended stack is **free in the sense that matters**: MIT and Apache 2.0
weights carry no licence fee, no per-request charge, no metering, no seat count,
and no account. Model weights are a one-time download, ideally mirrored locally so
the fetch is not repeated. There is no vendor invoice at any volume.

That leaves compute, which is not zero but can be **hardware Takineo already
needs**, because no GPU is strictly required.

**Transcription without a GPU.** `whisper.cpp` runs `large-v3-turbo` on plain CPU
at roughly 0.6–2.3× real time depending on the processor
([measured CPU figures](https://github.com/handy-computer/transcribe.cpp/blob/main/docs/models/whisper-large-v3-turbo.md)),
so a 15-minute session takes on the order of 7–25 minutes of CPU time. Smaller
checkpoints (`small.en`, `base.en`) run several times faster at reduced accuracy.

**Analysis without a GPU.** A 7–8B instruct model at `Q4_K_M` needs about
4.5–5.2 GB of RAM and generates at ~3–4.5 tokens/s on a modest 4-core Xeon VPS,
rising to ~15–20 tokens/s on a modern DDR5 CPU
([CPU benchmarks](https://dev.to/manoir_yantai_f22f01340f0/-running-llms-on-cpu-in-2026-real-benchmarks-from-a-4-core-xeon-server-a-4-57c6);
[llama.cpp quantization study](https://arxiv.org/pdf/2601.14277)). One session
means roughly a 2,700-token transcript in and under a thousand tokens out, so a
few minutes per session on cheap hardware and well under a minute on a current
CPU.

**Conclusion:** a CPU-only VPS with roughly 8 GB of RAM runs the whole pipeline at
**zero marginal cost per session**, taking minutes rather than seconds. Because
analysis is asynchronous and post-session (§3 of the contract), minutes are
acceptable — no student or teacher waits on it. A GPU becomes worthwhile only if
volume grows or turnaround needs to shrink, and §4.1's ~20-second GPU figures show
that upgrade path is cheap when it is wanted. Nothing about the design changes.

Two honest qualifications. "Free" means no licence or usage fees, not no cost:
operator time for hosting and upgrades is real, and it is the price of not having
a counterparty who can terminate the account. And no free commercial tier is being
passed up here — every provider in §3 is closed to us regardless of price, so
there is no cheaper alternative on the table.

**Recommended starting point under this constraint:** CPU-only,
`whisper.cpp` with `large-v3-turbo` for transcription and a 7–8B Apache 2.0
instruct model at `Q4_K_M` for analysis. Both sit behind the ports of §4.3, so
moving to a GPU later is a configuration change rather than a rewrite.

## 7. Decisions this document cannot make

Escalated rather than assumed, per `AGENTS.md`.

1. **Recording consent and legal basis — blocking.** The pipeline's input is a
   recording of a private conversation between two identified people, one of whom
   may be a minor. Nothing in the product spec currently establishes consent to
   record, consent to machine analysis, who may access the audio, or the
   retention period. This is a product and legal decision and it gates the
   *first* real recording, not the last. Phase 2 against synthetic audio does not
   touch it, which is another reason to build against a fixture first.
2. **Audio retention.** Is audio deleted after successful analysis, retained for
   a fixed window for reprocessing, or kept indefinitely? This changes the
   storage design and cost, and it interacts with (1).
3. **Who sees AI output.** `docs/agents/roadmap.md` requires that "AI results must
   remain distinguishable from teacher-reviewed results". Wave 4 will therefore
   mark all output as AI-generated and expose nothing to students, but *whether a
   teacher must approve a report before a student sees it* is a product decision
   for the review-interface wave, not for this pipeline.
4. **Compute host.** Deferred to §4.3, deliberately, and not to be resolved by
   touching the contractor's VPS work.
5. **Model pinning policy.** Model version is part of the output's meaning, so
   changing it changes results for identical audio. The contract persists engine
   and model identity per run; the *upgrade and re-analysis* policy is an
   operational decision.

## 8. Re-verification

Provider terms are a moving target (§1). Before any future decision to adopt a
commercial provider, re-check that provider's supported-country list, ownership
clause, and payment-country rule on that date, and record the result here rather
than relying on this snapshot.

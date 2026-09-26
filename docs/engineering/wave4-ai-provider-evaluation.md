# Wave 4 AI / Speech Provider Evaluation

**Owner:** Wave 4 — AI Conversation Intelligence (`feat/wave4-ai-pipeline`)
**Baseline:** `integration/wave2-final` (`12ebf3ad`)
**Evidence gathered:** 2026-09-12
**Status:** **SELF-HOSTING APPROVED** (2026-09-13). Do not integrate any
commercial AI or STT provider. Analysis checkpoint and weight-transfer plan are
pinned in §4.2 and §9. Product decisions that were open in §7 are now locked.

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

### 4.2 Analysis — pinned checkpoint

Transcription alone does not produce vocabulary lists, weak points, or
suggestions. That step needs a language model that is self-hostable under a
licence with no geography clause.

**Pinned analysis runtime (2026-09-13):**

| Field | Value |
|---|---|
| Instruct checkpoint | [`Qwen/Qwen2.5-7B-Instruct`](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct) |
| Parameters | 7.62B |
| Licence | **Apache 2.0** (read on the model card; no geography clause) |
| Quantization | **Q4_K_M** |
| GGUF repo | [`Qwen/Qwen2.5-7B-Instruct-GGUF`](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF) |
| Files | `qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf` (3.72 GiB) + `qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf` (0.64 GiB) |
| Total weight size | **4.36 GiB** |
| Engine | `llama.cpp` (CPU; `n_gpu_layers=0`) |
| Why this and not Qwen3-8B | Qwen3's thinking mode leaks into JSON unless disabled; Qwen2.5-Instruct is the structured-output workhorse at 7B. Official GGUF, not a third-party requant. |
| Why not Mistral-7B-Instruct | Also Apache 2.0, but weaker at schema-constrained JSON for this job. |
| Rejected | Qwen flagship "Max" (bespoke / MaaS), Llama 4 (community licence + MAU/EU clauses), Gemma (Google AUP attaches) |

Apache 2.0 is a licence, not a service, so there is no counterparty who can decide
next quarter that Iran is unsupported. The family name is not sufficient: Qwen's
small instruct models are Apache 2.0 while its flagship is not. This pin is the
specific GGUF pair above. Changing either file, the quant, or the instruct
checkpoint is a contract change and applies **going forward only** (evaluation
§7.5).

The analysis prompt runs once per completed 15-minute session. Quality is judged
against the review fixture in `scripts/wave4-analysis-fixture-probe.py`, not
against "it loaded in 8 GB".

**Fixture probe (2026-09-16):** CPU `llama-cpp-python` 0.3.35 (`n_gpu_layers=0`,
`n_ctx=4096`) against the split Q4_K_M pair on D:. Wall clock ~250 s on an
11.8 GiB workstation. Raw JSON still contained both past-tense sites in **one**
`PAST_SIMPLE` item (`go`→`went` and `meet`→`met` in the same sentence); neither
verb disappeared. `discuss about` was rewritten to past `discussed`, which is
the correct form in this yesterday-framed exchange. Domain `acceptCorrections`
now splits multi-site error citations and requires a unique span; the fixture's
expected lexical pair is `discuss about`→`discussed`. Teacher line untouched; no
invented C1 `substantial`. Do not treat raw `passesCoreQuality` as "the model
already emitted one correction per occurrence."

### 4.3 Where this actually runs — locked

Wave 4 compute is a **separate, modest CPU-only Iranian VPS**, decoupled from the
LiveKit contractor's host, tarball, and `diagnostics/iran-webrtc/` work. Do not
install models on the LiveKit machine. Hosting for object storage remains
deferred behind the S3-compatible port (§5).

Wave 4 code still depends on an *interface*, not a host: a transcription engine
port, an analysis engine port, and an S3-compatible storage port. Phase 2 stays
on fakes. The analysis VPS is where the pinned GGUF and Whisper weights live,
not where pipeline logic is rewritten.

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
2. **Analysis:** `Qwen/Qwen2.5-7B-Instruct` at **Q4_K_M**, official split GGUF
   (`qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf` +
   `qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf`, 4.36 GiB). Apache 2.0.
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
`whisper.cpp` with `large-v3-turbo` for transcription and the pinned
`Qwen2.5-7B-Instruct` Q4_K_M GGUF for analysis. Both sit behind the ports of
§4.3, so moving to a GPU later is a configuration change rather than a rewrite.

## 7. Product decisions — locked 2026-09-13

These were open. They are now product rules. Legal *wording* for consent copy is
still pending counsel; the *framework* is not.

1. **Recording consent — blocking, both participants.** No recording starts
   without explicit opt-in from the student and the teacher. If the student is a
   minor, a hard guardian-consent gate is required in addition to the student's
   opt-in. Final legal wording is pending actual legal review, not this document.
   Synthetic fixtures remain the only input until that wording and the capture
   UI exist. This gates the first real recording.
2. **Audio retention.** Raw audio is deleted **7–14 days after successful
   analysis**. The exact integer is configuration
   (`SESSION_AUDIO_RETENTION_DAYS`), must be in `[7, 14]`, and fails closed if
   unset. Structured output (transcript, vocabulary, weak points, suggestions,
   teacher feedback) is retained long-term for progress tracking. Failed or
   abandoned runs do not start the deletion clock.
3. **Student visibility is gated, not labelled.** AI output is technically
   invisible to the student until a teacher has reviewed it. A provenance badge
   is not enough. No student read path may return analysis rows until a durable
   teacher-review mark exists. Wave 4 still does not build the student UI; the
   authorization rule is already this gate.
4. **Compute host.** A separate, modest CPU-only Iranian VPS. Decoupled from the
   LiveKit contractor's machine, install path, and `diagnostics/iran-webrtc/`.
5. **Model upgrades apply going forward only.** Changing the pinned GGUF,
   Whisper ggml, or engine version does not automatically re-analyze old
   sessions. Historical runs keep the engine and model identity they were
   written with. Re-analysis is an explicit operator action, never a side
   effect of a weight swap.

## 8. Re-verification

Provider terms are a moving target (§1). Self-hosting is the adopted path, so
this section applies only if a future decision re-opens a commercial provider:
re-check that provider's supported-country list, ownership clause, and
payment-country rule on that date, and record the result here rather than
relying on the 2026-09-12 snapshot.

## 9. Weight download and transfer

The Iranian analysis VPS cannot be assumed to reach Hugging Face, GitHub, or
any other foreign registry. This is the same constraint Wave 3 already solved
for LiveKit: **download on a reachable workstation, then SCP**. LiveKit's
installer states it in
`diagnostics/iran-webrtc/provision-host.sh`:

```text
# Host cannot reach GitHub; download on Windows via gh-proxy then scp:
#   curl.exe -L --fail -o livekit_1.13.6_linux_amd64.tar.gz "..."
#   scp -o BatchMode=yes livekit_1.13.6_linux_amd64.tar.gz provision-host.sh takineo-livekit:~/livekit-provision/
```

Wave 4 copies that pattern, sized for **gigabytes**, not a ~50 MB tarball.

### 9.1 What is transferred

| Artifact | Source | Bytes on disk | Lands on analysis VPS |
|---|---|---|---|
| Analysis GGUF shard 1 | `Qwen/Qwen2.5-7B-Instruct-GGUF` / `qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf` | 3.72 GiB | `/var/lib/takineo/models/analysis/` |
| Analysis GGUF shard 2 | same repo / `qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf` | 0.64 GiB | same directory |
| Whisper ggml (fp16) | `ggerganov/whisper.cpp` / `ggml-large-v3-turbo.bin` | 1.51 GiB | `/var/lib/takineo/models/transcription/` |
| Whisper ggml (optional CPU squeeze) | `ggml-large-v3-turbo-q5_0.bin` | 0.53 GiB | same directory, only if RAM is tighter than planned |

Do not SCP Hugging Face caches, Python virtualenvs, or the git worktree. Do not
place weights on the LiveKit host. Do not commit weights.

### 9.2 Workstation download (Windows)

C: on the current workstation is too small (~6 GB free). Use **D:**.

```text
mkdir D:\takineo-models\qwen2.5-7b-instruct-q4_k_m
hf download Qwen/Qwen2.5-7B-Instruct-GGUF --include "qwen2.5-7b-instruct-q4_k_m*" --local-dir D:\takineo-models\qwen2.5-7b-instruct-q4_k_m

mkdir D:\takineo-models\whisper-large-v3-turbo
hf download ggerganov/whisper.cpp --include "ggml-large-v3-turbo.bin" --local-dir D:\takineo-models\whisper-large-v3-turbo
```

If Hugging Face is itself blocked from the workstation, fetch via the same
class of reachable proxy already used for the LiveKit tarball, then keep the
files on D: as the local mirror. The analysis VPS still never talks to the
registry.

**2026-09-13 workstation evidence:** this Windows box can read Hugging Face
*metadata* (`/api/models/...` returned 200) and cannot pull the GGUF *blob*
without a reachable path to `us.aws.cdn.hf.co`. `hf download` sat at 0 bytes;
`HF_ENDPOINT=https://hf-mirror.com` 308s back to official Hugging Face. Do not
treat "the API page loaded" as "the weights can be fetched from Iran."

**2026-09-16:** both analysis shards are on
`D:\takineo-models\qwen2.5-7b-instruct-q4_k_m\`. `hf` still stalled at 0 bytes
through Windscribe; resumable `curl.exe -4 -L --http1.1` against the Hub
`/resolve/` URL completed the pair. SHA-256 (workstation, travel with SCP):

| File | Bytes | SHA-256 |
|---|---|---|
| `qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf` | 3,993,201,344 | `dfce12e3862a5283ccfb88221b48480e58745165de856439950d0f22590580db` |
| `qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf` | 689,872,288 | `539cf93f78e887edea1c04e2d7d8cdaca9d01dae9c9025bcb8accbe29df3d72a` |
| `ggml-large-v3-turbo.bin` | 1,624,555,275 | `1fc70f774d38eb169993ac391eea357ef47c88757ef72ee5943879b7e8e2bc69` |

Whisper landed at `D:\takineo-models\whisper-large-v3-turbo\`. Check these hashes
on the analysis host before pointing `llama.cpp` or `whisper.cpp` at the files.

### 9.3 SCP onto the analysis host

The SSH alias is assigned when the VPS exists. Until then the name
`takineo-analysis` is a placeholder, parallel to `takineo-livekit`. Resume
matters: a 4.36 GiB copy over a domestic uplink is not a one-shot `scp` of a
deb.

```text
ssh takineo-analysis "sudo mkdir -p /var/lib/takineo/models/analysis /var/lib/takineo/models/transcription && sudo chown -R ${USER}:${USER} /var/lib/takineo"

scp -o BatchMode=yes -C D:\takineo-models\qwen2.5-7b-instruct-q4_k_m\qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf takineo-analysis:/var/lib/takineo/models/analysis/
scp -o BatchMode=yes -C D:\takineo-models\qwen2.5-7b-instruct-q4_k_m\qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf takineo-analysis:/var/lib/takineo/models/analysis/
scp -o BatchMode=yes -C D:\takineo-models\whisper-large-v3-turbo\ggml-large-v3-turbo.bin takineo-analysis:/var/lib/takineo/models/transcription/
```

If the link drops, finish with `rsync -avP` or `scp -C` against the same
destination; do not restart a completed shard. After transfer, `sha256sum`
must match the workstation hashes. `llama.cpp` loads shard 1 and expects shard
2 beside it; do not rename the files.

### 9.4 Storage the target host needs

These are weights plus working room, not the application disk.

| Use | Size |
|---|---|
| Analysis GGUF pair | 4.36 GiB |
| Whisper `large-v3-turbo` ggml | 1.51 GiB |
| Peak RAM while analyzing (model + KV + OS) | ~5.5–6.5 GiB of an **8 GiB** machine; do not run Whisper and the LLM at once |
| Scratch for one 15-minute dual-track WAV pair | tens of MB; keep a few GB for overlapping jobs |
| Logs, engines, OS | ~10 GiB |

**Minimum disk for the analysis VPS: 40 GiB.** That holds both models, a
future replacement GGUF sitting next to the live one during a forward-only
upgrade, a handful of not-yet-deleted audio objects (7–14 day window), and OS
headroom. **8 GiB RAM is the floor** and requires sequential transcribe-then-
analyze. 12 GiB RAM is the comfortable floor if anything else shares the box.

Do not provision this disk on the LiveKit VPS.

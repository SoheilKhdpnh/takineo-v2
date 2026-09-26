"""Probe the pinned Wave 4 analysis GGUF against the review fixture.

This is an operator script, not a unit test. It does not touch LiveKit, the
booking path, or any commercial API. Weights stay outside the git worktree.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

FIXTURE_TRANSCRIPT = """STUDENT  Yesterday I go to the university and I meet my friend.
TEACHER  What did you do there?
STUDENT  We discuss about our project."""

SYSTEM_PROMPT = """You are Takineo's session-analysis engine.
Return ONLY a JSON object. No markdown. No preamble.
Correct only STUDENT utterances. Never correct the teacher.
Use only these correction types: GRAMMAR_ERROR, LEXICAL_ERROR, NATURALNESS, OPTIONAL_IMPROVEMENT.
Use only these grammar subtypes when they apply: PAST_SIMPLE, PREPOSITION, ARTICLE, SUBJECT_VERB_AGREEMENT, WORD_ORDER, OTHER.
Use OTHER only if no registry token fits. Two unrelated OTHER items are not a pattern.
NATURALNESS and OPTIONAL_IMPROVEMENT are not errors.
The student working level is A2. Do not suggest vocabulary above B1.
Do not invent a weak-point pattern from a single error.

JSON shape:
{
  "overallLevelEstimate": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|null,
  "summaryEn": string,
  "corrections": [
    {
      "type": "GRAMMAR_ERROR"|"LEXICAL_ERROR"|"NATURALNESS"|"OPTIONAL_IMPROVEMENT",
      "subtype": string,
      "originalText": string,
      "correctedText": string,
      "explanation": string,
      "transcriptSegmentIndex": 0|1|2
    }
  ]
}"""

USER_PROMPT = f"""Analyze this 15-minute speaking-session excerpt.

{FIXTURE_TRANSCRIPT}

Identify tense errors, lexical errors, and nothing else that is not in the text."""

REQUIRED_PAIRS = (
    ("go", "went"),
    ("meet", "met"),
    ("discuss about", "discussed"),
)


def extract_json(text: str) -> dict:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("model output contained no JSON object")
    return json.loads(stripped[start : end + 1])


def evaluate(payload: dict) -> dict:
    corrections = payload.get("corrections") or []
    joined = [
        (
            str(item.get("originalText", "")).lower(),
            str(item.get("correctedText", "")).lower(),
            str(item.get("type", "")),
            str(item.get("subtype", "")),
        )
        for item in corrections
    ]

    found = {}
    for original, corrected in REQUIRED_PAIRS:
        found[f"{original}->{corrected}"] = any(
            original in left and corrected in right for left, right, _, _ in joined
        )

    grammar_past = [
        item
        for item in corrections
        if item.get("type") == "GRAMMAR_ERROR"
        and str(item.get("subtype", "")).upper() == "PAST_SIMPLE"
    ]
    lexical_prep = [
        item
        for item in corrections
        if item.get("type") == "LEXICAL_ERROR"
        and "PREPOSITION" in str(item.get("subtype", "")).upper()
    ]
    teacher_hits = [
        item
        for item in corrections
        if "what did you do" in str(item.get("originalText", "")).lower()
    ]
    c1_suggestions = [
        item
        for item in corrections
        if "substantial" in str(item.get("correctedText", "")).lower()
    ]

    return {
        "requiredPairs": found,
        "pastSimpleCount": len(grammar_past),
        "lexicalPrepositionCount": len(lexical_prep),
        "teacherCorrected": len(teacher_hits) > 0,
        "inventedC1Suggestion": len(c1_suggestions) > 0,
        "correctionCount": len(corrections),
        "passesCoreQuality": all(found.values()) and not teacher_hits,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        default=r"D:\takineo-models\qwen2.5-7b-instruct-q4_k_m\qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf",
    )
    parser.add_argument("--threads", type=int, default=4)
    parser.add_argument("--max-tokens", type=int, default=900)
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.is_file():
        print(f"missing GGUF: {model_path}", file=sys.stderr)
        return 2

    from llama_cpp import Llama

    llm = Llama(
        model_path=str(model_path),
        n_ctx=4096,
        n_threads=args.threads,
        n_gpu_layers=0,
        verbose=False,
    )
    completion = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT},
        ],
        temperature=0.1,
        max_tokens=args.max_tokens,
        response_format={"type": "json_object"},
    )
    raw = completion["choices"][0]["message"]["content"] or ""
    print("=== raw ===")
    print(raw)
    payload = extract_json(raw)
    print("=== parsed ===")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    report = evaluate(payload)
    print("=== quality ===")
    print(json.dumps(report, indent=2))
    return 0 if report["passesCoreQuality"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

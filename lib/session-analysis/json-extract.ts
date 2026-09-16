export function extractJsonObject(text: string): unknown {
  const stripped = stripFence(text.trim());
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new SyntaxError("Output contained no JSON object.");
  }
  return JSON.parse(stripped.slice(start, end + 1)) as unknown;
}

function stripFence(text: string): string {
  if (!text.startsWith("```")) {
    return text;
  }
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

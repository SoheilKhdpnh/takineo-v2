import "server-only";

import {
  ProfileNotFoundError,
  ProfileRoleMismatchError,
} from "@/lib/errors/profile-errors";
import { prisma } from "@/lib/db/prisma";
import type { StudentAiChatInput } from "@/lib/validations/student-ai-chat";

export class StudentAiChatUnavailableError extends Error {
  readonly code = "AI_CHAT_UNAVAILABLE" as const;

  constructor(message = "Student AI chat endpoint is not configured.") {
    super(message);
    this.name = "StudentAiChatUnavailableError";
  }
}

export class StudentAiChatUpstreamError extends Error {
  readonly code = "AI_CHAT_UPSTREAM_ERROR" as const;

  constructor(message = "The AI chat upstream failed.") {
    super(message);
    this.name = "StudentAiChatUpstreamError";
  }
}

type ChatConfig = {
  baseUrl: string;
  model: string;
  apiKey: string | null;
};

function readChatConfig(): ChatConfig | null {
  const baseUrl = process.env.STUDENT_AI_CHAT_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    model:
      process.env.STUDENT_AI_CHAT_MODEL?.trim() ||
      "talkinu-student-assistant",
    apiKey: process.env.STUDENT_AI_CHAT_API_KEY?.trim() || null,
  };
}

export function isStudentAiChatConfigured(): boolean {
  return readChatConfig() !== null;
}

const SYSTEM_PROMPT = [
  "You are Talkinu's student study assistant for English learners in Iran.",
  "Answer extra questions about English learning, vocabulary, grammar,",
  "and how to prepare for 15-minute speaking sessions with human teachers.",
  "Keep answers clear, encouraging, and practical.",
  "Never claim to replace a human teacher.",
  "If you are unsure, say so and suggest booking a speaking session.",
  "Respond in the same language the student used in their latest message.",
].join(" ");

export async function askStudentAiChat(
  userId: string,
  input: StudentAiChatInput,
): Promise<{ reply: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      accountStatus: true,
      role: true,
    },
  });

  if (!user || user.accountStatus !== "ACTIVE") {
    throw new ProfileNotFoundError();
  }

  if (user.role !== "STUDENT") {
    throw new ProfileRoleMismatchError();
  }

  const config = readChatConfig();

  if (!config) {
    throw new StudentAiChatUnavailableError();
  }

  const endpoint = config.baseUrl.endsWith("/chat/completions")
    ? config.baseUrl
    : `${config.baseUrl}/v1/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...input.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new StudentAiChatUpstreamError();
  }

  if (!response.ok) {
    throw new StudentAiChatUpstreamError();
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new StudentAiChatUpstreamError();
  }

  const reply = extractAssistantText(payload);

  if (!reply) {
    throw new StudentAiChatUpstreamError();
  }

  return { reply };
}

function extractAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const choices = (payload as { choices?: unknown }).choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const first = choices[0];

  if (!first || typeof first !== "object") {
    return null;
  }

  const message = (first as { message?: unknown }).message;

  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as { content?: unknown }).content;

  if (typeof content !== "string") {
    return null;
  }

  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
}

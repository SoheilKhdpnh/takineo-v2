"use client";

import { useTranslations } from "next-intl";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { ChatIcon } from "@/components/ui/WorkspaceIcons";
import { cn } from "@/lib/ui/cn";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function StudentAiChatPanel() {
  const t = useTranslations("StudentAiChat");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/student/ai-chat", {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          setAvailable(false);
          return;
        }

        const payload = (await response.json()) as { available?: unknown };
        setAvailable(payload.available === true);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setAvailable(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();

    const content = draft.trim();

    if (!content || sending || available === false) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      const response = await fetch("/api/student/ai-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      if (response.status === 503) {
        setAvailable(false);
        setError(t("errors.unavailable"));
        return;
      }

      if (!response.ok) {
        setError(t("errors.generic"));
        return;
      }

      const payload = (await response.json()) as { reply?: unknown };
      const reply =
        typeof payload.reply === "string" ? payload.reply.trim() : "";

      if (reply.length === 0) {
        setError(t("errors.generic"));
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: reply,
        },
      ]);
    } catch {
      setError(t("errors.network"));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <section
      id="ai-chat"
      aria-labelledby="student-ai-chat-heading"
      className="scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-[#edddd4] bg-white shadow-[0_24px_60px_-42px_rgba(28,20,16,0.45)]"
    >
      <header className="flex items-start gap-4 border-b border-[#edddd4] bg-[linear-gradient(135deg,#fff4ed_0%,#fffaf6_55%,#ffffff_100%)] px-5 py-5 sm:px-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#c2410c] text-white shadow-[0_12px_28px_-16px_rgba(194,65,12,0.9)]">
          <ChatIcon />
        </span>
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#c2410c] uppercase">
            {t("eyebrow")}
          </p>
          <h2
            id="student-ai-chat-heading"
            className="mt-1 text-xl font-semibold tracking-tight text-zinc-950"
          >
            {t("title")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">
            {t("description")}
          </p>
        </div>
      </header>

      {available === false ? (
        <div className="px-5 py-8 sm:px-6">
          <div className="rounded-2xl border border-dashed border-[#e7c9b6] bg-[#fffaf6] px-4 py-6 text-sm leading-6 text-zinc-600">
            {t("unavailable")}
          </div>
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            className="max-h-[22rem] space-y-3 overflow-y-auto px-5 py-5 sm:px-6"
          >
            {messages.length === 0 ? (
              <div className="rounded-2xl bg-[#fffaf6] px-4 py-5 text-sm leading-6 text-zinc-600 ring-1 ring-[#edddd4]">
                <p className="font-semibold text-zinc-900">{t("starterTitle")}</p>
                <ul className="mt-3 space-y-2">
                  {[t("starterOne"), t("starterTwo"), t("starterThree")].map(
                    (prompt) => (
                      <li key={prompt}>
                        <button
                          type="button"
                          disabled={available !== true || sending}
                          onClick={() => setDraft(prompt)}
                          className="w-full rounded-xl bg-white px-3 py-2.5 text-start text-sm text-zinc-700 ring-1 ring-[#edddd4] transition hover:bg-[#fff4ed] hover:text-[#9a3412] disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6",
                    message.role === "user"
                      ? "ms-auto bg-[#c2410c] text-white"
                      : "me-auto bg-[#fffaf6] text-zinc-800 ring-1 ring-[#edddd4]",
                  )}
                >
                  {message.content}
                </div>
              ))
            )}

            {sending ? (
              <p className="text-xs font-medium text-[#c2410c]">{t("thinking")}</p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-900 sm:px-6"
            >
              {error}
            </p>
          ) : null}

          <form
            onSubmit={(event) => void sendMessage(event)}
            className="border-t border-[#edddd4] bg-[#fffaf6] px-5 py-4 sm:px-6"
          >
            <label className="sr-only" htmlFor="student-ai-chat-input">
              {t("inputLabel")}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <textarea
                id="student-ai-chat-input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                maxLength={4000}
                disabled={sending || available !== true}
                placeholder={t("placeholder")}
                className="min-h-20 flex-1 resize-y rounded-2xl border border-[#edddd4] bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-[#c2410c] focus:ring-2 focus:ring-[#c2410c]/15 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={
                  sending ||
                  available !== true ||
                  draft.trim().length === 0
                }
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#c2410c] px-5 text-sm font-semibold text-white transition hover:bg-[#9a3412] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {sending ? t("sending") : t("send")}
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{t("footnote")}</p>
          </form>
        </>
      )}
    </section>
  );
}

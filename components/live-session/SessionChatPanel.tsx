"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useTranslations,
} from "next-intl";

import {
  Button,
} from "@/components/ui/Button";
import { cn } from "@/lib/ui/cn";

import {
  SESSION_CHAT_MAX_LENGTH,
  normalizeOutgoingChatText,
  type SessionChatMessage,
} from "@/components/live-session/session-chat-model";

export function SessionChatPanel({
  messages,
  counterpartName,
  onSend,
  onClose,
  className,
}: {
  messages: readonly SessionChatMessage[];
  counterpartName: string;
  onSend: (text: string) => Promise<boolean>;
  onClose: () => void;
  className?: string;
}) {
  const t = useTranslations("LiveSessionJoin");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const logRef = useRef<HTMLOListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const log = logRef.current;

    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [messages.length]);

  async function handleSubmit() {
    const text = normalizeOutgoingChatText(draft);

    if (!text || sending) {
      return;
    }

    setSending(true);
    setSendError(false);
    const sent = await onSend(text);
    setSending(false);

    if (sent) {
      setDraft("");
      inputRef.current?.focus();
      return;
    }

    setSendError(true);
  }

  return (
    <section
      aria-label={t("chat.title")}
      className={cn(
        "flex min-h-0 flex-col rounded-lg border border-line bg-surface",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="font-semibold text-ink">{t("chat.title")}</h2>
          <p className="text-xs text-ink-muted">{t("chat.ephemeralNotice")}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("chat.close")}
        </Button>
      </header>

      <ol
        ref={logRef}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <li className="text-sm text-ink-muted">{t("chat.empty")}</li>
        ) : (
          messages.map((message) => {
            const mine = message.author === "self";

            return (
              <li
                key={message.id}
                className={cn("flex flex-col", mine ? "items-end" : "items-start")}
              >
                <span className="mb-1 text-xs text-ink-muted">
                  {mine ? t("call.you") : counterpartName}
                </span>
                <p
                  dir="auto"
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-6",
                    mine ? "bg-primary text-white" : "bg-mint text-ink",
                  )}
                >
                  {message.text}
                </p>
              </li>
            );
          })
        )}
      </ol>

      <form
        className="border-t border-line px-3 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <label htmlFor="session-chat-input" className="sr-only">
          {t("chat.inputLabel")}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="session-chat-input"
            ref={inputRef}
            dir="auto"
            autoComplete="off"
            maxLength={SESSION_CHAT_MAX_LENGTH}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setSendError(false);
            }}
            placeholder={t("chat.placeholder")}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-primary"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || normalizeOutgoingChatText(draft) === null}
          >
            {t("chat.send")}
          </Button>
        </div>
        {sendError ? (
          <p className="mt-2 text-xs text-danger" role="alert">
            {t("chat.sendError")}
          </p>
        ) : null}
      </form>
    </section>
  );
}

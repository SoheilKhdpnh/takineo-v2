import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";

import { LiveSessionJoinRoom } from "@/components/live-session/LiveSessionJoinRoom";
import { requireAppLocale } from "@/i18n/locale";
import { requireAuthenticatedPage } from "@/lib/auth/page-guards";
import { liveSessionReadIdSchema } from "@/lib/validations/live-session";

interface LiveSessionJoinPageProps {
  params: Promise<{
    locale: string;
    sessionId: string;
  }>;
}

export default async function LiveSessionJoinPage({
  params,
}: LiveSessionJoinPageProps) {
  const {
    locale: requestedLocale,
    sessionId,
  } = await params;

  const locale = requireAppLocale(requestedLocale);

  setRequestLocale(locale);

  const parsedSessionId = liveSessionReadIdSchema.safeParse(sessionId);

  if (!parsedSessionId.success) {
    notFound();
  }

  await requireAuthenticatedPage(locale);

  const t = await getTranslations({
    locale,
    namespace: "LiveSessionJoin",
  });

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-12">
      <section className="mx-auto max-w-3xl">
        <p className="sr-only">
          {t("pageReady")}
        </p>
        <LiveSessionJoinRoom sessionId={parsedSessionId.data} />
      </section>
    </main>
  );
}

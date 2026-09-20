import {
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { notFound } from "next/navigation";

import { LiveSessionJoinRoom } from "@/components/live-session/LiveSessionJoinRoom";
import { requireAppLocale } from "@/i18n/locale";
import { requireAuthenticatedPage } from "@/lib/auth/page-guards";
import {
  SessionReadForbiddenError,
  SessionReadTargetNotFoundError,
} from "@/lib/errors/session-read-errors";
import {
  getSpeakingSessionForViewer,
} from "@/lib/services/speaking-session-read.service";
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

  const { session } = await requireAuthenticatedPage(locale);

  let view;

  try {
    view = await getSpeakingSessionForViewer(
      session.user.id,
      parsedSessionId.data,
    );
  } catch (error) {
    if (
      error instanceof SessionReadTargetNotFoundError ||
      error instanceof SessionReadForbiddenError
    ) {
      notFound();
    }

    throw error;
  }

  const tJoin = await getTranslations({
    locale,
    namespace: "LiveSessionJoin",
  });
  const tSite = await getTranslations({
    locale,
    namespace: "Site",
  });

  const viewerRole =
    view.counterparty.type === "TEACHER" ? "STUDENT" : "TEACHER";
  const selfName =
    session.user.name?.trim() || tJoin("call.you");

  return (
    <>
      <p className="sr-only">{tJoin("pageReady")}</p>
      <LiveSessionJoinRoom
        brand={tSite("brand")}
        context={{
          sessionId: view.id,
          viewerRole,
          selfName,
          selfImage: session.user.image ?? null,
          counterparty: {
            name: view.counterparty.name,
            image: view.counterparty.image,
          },
          startAt: view.startAt.toISOString(),
          endAt: view.endAt.toISOString(),
          status: view.status,
        }}
      />
    </>
  );
}

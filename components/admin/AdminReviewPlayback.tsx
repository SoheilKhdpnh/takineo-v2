import { AparatEmbed } from "@/components/video/AparatEmbed";

export interface AdminReviewPlaybackCopy {
  description: string;
  codeLabel: string;
  spokenPhraseLabel: string;
  spokenPhrase: string;
  playerTitle: string;
  unavailableState: string;
  publicHostNote: string;
}

interface AdminReviewPlaybackProps {
  embedUrl: string | null;
  verificationCode: string | null;
  enabled: boolean;
  copy: AdminReviewPlaybackCopy;
}

export function AdminReviewPlayback({
  embedUrl,
  verificationCode,
  enabled,
  copy,
}: AdminReviewPlaybackProps) {
  if (!enabled || !embedUrl || !verificationCode) {
    return (
      <p className="mt-3 text-sm leading-7 text-zinc-600">
        {copy.unavailableState}
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-sm leading-7 text-zinc-600">{copy.description}</p>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
          {copy.codeLabel}
        </p>
        <p
          className="mt-2 font-mono text-3xl font-semibold tracking-[0.22em] text-zinc-950"
          dir="ltr"
        >
          {verificationCode}
        </p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900">
          {copy.spokenPhraseLabel}
        </p>
        <p className="mt-1 text-sm font-medium leading-6 text-zinc-900" dir="ltr">
          {copy.spokenPhrase}
        </p>
      </div>
      <AparatEmbed embedUrl={embedUrl} title={copy.playerTitle} />
      <p className="text-xs leading-6 text-zinc-500">{copy.publicHostNote}</p>
    </div>
  );
}

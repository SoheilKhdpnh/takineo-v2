interface AparatEmbedProps {
  embedUrl: string;
  title: string;
}

export function AparatEmbed({ embedUrl, title }: AparatEmbedProps) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-950">
      <iframe
        src={embedUrl}
        title={title}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

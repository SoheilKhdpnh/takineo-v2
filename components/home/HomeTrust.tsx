import Image from "next/image";

import { Card } from "@/components/ui/Card";

export function HomeTrust({
  durationTitle,
  durationBody,
  teachersTitle,
  teachersBody,
  aiTitle,
  aiBody,
  imageAlt,
}: {
  durationTitle: string;
  durationBody: string;
  teachersTitle: string;
  teachersBody: string;
  aiTitle: string;
  aiBody: string;
  imageAlt: string;
}) {
  return (
    <section className="border-y border-line bg-mint/60">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-12">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <Image
            src="/images/home/supporting-conversation.webp"
            alt={imageAlt}
            width={960}
            height={720}
            quality={70}
            sizes="(max-width: 1024px) 100vw, 520px"
            className="h-full w-full object-cover"
          />
        </div>

        <div className="grid gap-4">
          <TrustItem title={durationTitle} body={durationBody} />
          <TrustItem title={teachersTitle} body={teachersBody} />
          <TrustItem title={aiTitle} body={aiBody} />
        </div>
      </div>
    </section>
  );
}

function TrustItem({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <Card>
      <h2 className="text-lg text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-ink-muted">{body}</p>
    </Card>
  );
}

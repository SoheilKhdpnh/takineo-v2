export const APARAT_SPOKEN_PHRASE =
  "This video is recorded for the Talkinu team";

const APARAT_HOSTS = new Set([
  "aparat.com",
  "www.aparat.com",
  "m.aparat.com",
]);

const APARAT_HASH_PATTERN = /^[A-Za-z0-9_-]{4,32}$/;

export type ParsedAparatVideo = {
  hash: string;
  canonicalUrl: string;
  embedUrl: string;
};

export function aparatCanonicalUrl(hash: string): string {
  return `https://www.aparat.com/v/${hash}`;
}

export function aparatEmbedUrl(hash: string): string {
  return `https://www.aparat.com/video/video/embed/videohash/${hash}/vt/frame`;
}

function extractAparatHash(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "v" && segments[1]) {
    return segments[1];
  }

  const hashIndex = segments.lastIndexOf("videohash");
  if (hashIndex >= 0 && segments[hashIndex + 1]) {
    return segments[hashIndex + 1];
  }

  return null;
}

export function parseAparatVideoUrl(
  raw: string,
): ParsedAparatVideo | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!APARAT_HOSTS.has(hostname)) {
    return null;
  }

  const hash = extractAparatHash(parsed.pathname);
  if (!hash || !APARAT_HASH_PATTERN.test(hash)) {
    return null;
  }

  return {
    hash,
    canonicalUrl: aparatCanonicalUrl(hash),
    embedUrl: aparatEmbedUrl(hash),
  };
}

import "server-only";

import { isIP } from "node:net";

import { serverEnv } from "@/lib/env/server";

function originFromUrl(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function wwwAlternateOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      isIP(hostname)
    ) {
      return null;
    }

    if (hostname.startsWith("www.")) {
      url.hostname = hostname.slice(4);
    } else {
      url.hostname = `www.${hostname}`;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getTrustedApplicationOrigins(): string[] {
  const origins = new Set<string>();
  const origin = originFromUrl(serverEnv.BETTER_AUTH_URL);

  if (origin) {
    origins.add(origin);
    const wwwOrigin = wwwAlternateOrigin(origin);
    if (wwwOrigin) {
      origins.add(wwwOrigin);
    }
  }

  return [...origins];
}

export function isTrustedApplicationOrigin(
  originHeader: string | null,
): boolean {
  if (!originHeader) {
    return false;
  }

  try {
    const origin = new URL(originHeader).origin;
    return getTrustedApplicationOrigins().includes(origin);
  } catch {
    return false;
  }
}

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

export async function getSessionFromHeaders(
  requestHeaders: Headers,
) {
  return auth.api.getSession({
    headers: requestHeaders,
  });
}

export async function getCurrentSession() {
  return getSessionFromHeaders(await headers());
}
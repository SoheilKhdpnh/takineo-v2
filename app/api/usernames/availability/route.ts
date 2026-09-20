import { NextResponse } from "next/server";

import { InvalidUsernameError } from "@/lib/errors/signup-errors";
import { isUsernameAvailable } from "@/lib/services/username-availability.service";
import { usernameAvailabilityQuerySchema } from "@/lib/validations/username-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username");
  const parsed = usernameAvailabilityQuerySchema.safeParse({ username });

  if (!parsed.success) {
    return publicJson(
      {
        available: false,
        error: "INVALID_USERNAME",
      },
      { status: 400 },
    );
  }

  try {
    const available = await isUsernameAvailable(parsed.data.username);

    if (!available) {
      return publicJson({
        available: false,
        error: "USERNAME_TAKEN",
      });
    }

    return publicJson({
      available: true,
    });
  } catch (error) {
    if (error instanceof InvalidUsernameError) {
      return publicJson(
        {
          available: false,
          error: "INVALID_USERNAME",
        },
        { status: 400 },
      );
    }

    console.error("Username availability lookup failed.");

    return publicJson(
      {
        error: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";

import { getSessionFromHeaders } from "@/lib/auth/session";
import {
  OnboardingAlreadyCompletedError,
  OnboardingStateConflictError,
  UserNotFoundError,
} from "@/lib/errors/onboarding-errors";
import { hasTrustedRequestOrigin } from "@/lib/security/request-origin";
import { completeOnboarding } from "@/lib/services/onboarding.service";
import { onboardingSchema } from "@/lib/validations/onboarding";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasTrustedRequestOrigin(request)) {
    return NextResponse.json(
      {
        error: "Untrusted request origin.",
      },
      {
        status: 403,
      },
    );
  }

  const session = await getSessionFromHeaders(
    request.headers,
  );

  if (!session) {
    return NextResponse.json(
      {
        error: "Authentication is required.",
      },
      {
        status: 401,
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "The request body must be valid JSON.",
      },
      {
        status: 400,
      },
    );
  }

  const parsedBody = onboardingSchema.safeParse(body);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid onboarding data.",
        fields:
          parsedBody.error.flatten().fieldErrors,
      },
      {
        status: 400,
      },
    );
  }

  try {
    const user = await completeOnboarding({
      userId: session.user.id,
      role: parsedBody.data.role,
    });

    return NextResponse.json(
      {
        data: user,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (
      error instanceof
        OnboardingAlreadyCompletedError ||
      error instanceof OnboardingStateConflictError
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 409,
        },
      );
    }

    if (error instanceof UserNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 404,
        },
      );
    }

    console.error("Onboarding failed:", error);

    return NextResponse.json(
      {
        error: "Unable to complete onboarding.",
      },
      {
        status: 500,
      },
    );
  }
}
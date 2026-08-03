import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DatabaseProbe {
  result: number;
}

export async function GET() {
  const startedAt = performance.now();

  try {
    const rows = await prisma.$queryRaw<DatabaseProbe[]>`
      SELECT 1 AS result
    `;

    if (rows[0]?.result !== 1) {
      throw new Error("Unexpected database probe response");
    }

    const responseTimeMs = Math.round(
      performance.now() - startedAt,
    );

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        responseTimeMs,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
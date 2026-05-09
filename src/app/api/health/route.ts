import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  if (redis) {
    try {
      await redis.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
  } else {
    checks.redis = "not_configured";
  }

  const allOk = Object.values(checks).every((v) => v === "ok" || v === "not_configured");

  return NextResponse.json(
    {
      ok: allOk,
      status: allOk ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
    { status: allOk ? 200 : 503 }
  );
}

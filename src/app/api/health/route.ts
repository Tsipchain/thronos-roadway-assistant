import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Simple liveness probe that also wakes the Neon DB connection.
export async function GET(_req: NextRequest) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: 'connected' });
  } catch (e: any) {
    // Force reconnect on next request
    try { await prisma.$disconnect(); } catch {}
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
  }
}

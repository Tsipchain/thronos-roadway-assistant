export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  distributeRewards,
  getRewardHistory,
  getRewardStats,
} from "@/lib/pricing-admin";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId || !user.tenant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get("metric") || "history";

    if (metric === "history") {
      const history = await getRewardHistory(user.tenantId);
      return NextResponse.json({ ok: true, history });
    } else if (metric === "stats") {
      const stats = await getRewardStats(user.tenantId);
      return NextResponse.json({ ok: true, stats });
    }

    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  } catch (error) {
    console.error("Get rewards error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { tenant: true },
    });

    if (!user?.tenantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { memberId, amount, reason } = await req.json();

    if (!memberId || !amount || !reason) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    const tx = await distributeRewards(user.tenantId, memberId, amount, reason);

    return NextResponse.json({ ok: true, tx }, { status: 201 });
  } catch (error) {
    console.error("Distribute rewards error:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Internal error" },
      { status: 500 }
    );
  }
}

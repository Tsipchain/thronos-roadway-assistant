// Super-admin confirms EUR received → triggers BTC send
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.p2POrder.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.status !== "QUOTE") {
    return NextResponse.json({ error: `Order is already ${order.status}` }, { status: 409 });
  }

  // Mark as PAID — BTC send triggered via Thronos node
  const updated = await prisma.p2POrder.update({
    where: { id: params.id },
    data: { status: "PAID", paidAt: new Date() },
  });

  // Fire BTC send via Thronos chain hot wallet (async)
  triggerBtcSend(params.id, order.destinationBtc, order.btcAmount).catch(console.error);

  return NextResponse.json({ ok: true, status: updated.status });
}

async function triggerBtcSend(orderId: string, destination: string, amount: number) {
  const nodeUrl = process.env.THRONOS_NODE_URL ?? "https://thrchain.up.railway.app";
  const adminSecret = process.env.ADMIN_SECRET ?? "";

  try {
    const res = await fetch(`${nodeUrl}/api/btc/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: adminSecret,
        to_address: destination,
        amount,
        memo: `P2P order ${orderId}`,
      }),
    });
    const data = await res.json();
    const txHash = data.txid ?? data.tx_hash ?? null;

    await prisma.p2POrder.update({
      where: { id: orderId },
      data: {
        status: txHash ? "SENT" : "PAID",
        btcTxHash: txHash,
        sentAt: txHash ? new Date() : null,
      },
    });
  } catch (e) {
    console.error("BTC send error for order", orderId, e);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Mark invoice as paid (bank transfer) — super admin only
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { bankRef, paymentMethod = "bank" } = await req.json();

  const invoice = await prisma.tenantInvoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (invoice.status === "PAID") {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }

  const updated = await prisma.tenantInvoice.update({
    where: { id: params.id },
    data: { status: "PAID", paidAt: new Date(), bankRef, paymentMethod },
  });

  return NextResponse.json({ ok: true, invoice: updated });
}

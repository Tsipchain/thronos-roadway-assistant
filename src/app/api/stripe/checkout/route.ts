import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for a TenantInvoice.
 * Body: { invoiceId }
 * Returns: { url } — redirect to Stripe-hosted checkout page.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const { invoiceId } = await req.json();
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 });

  const invoice = await prisma.tenantInvoice.findUnique({
    where: { id: invoiceId },
    include: { tenant: { select: { name: true, slug: true, stripeCustomerId: true } } },
  });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 400 });

  // Access control: SUPER_ADMIN or the tenant's own admin
  const isSuper = session.user.role === "SUPER_ADMIN";
  const isTenantAdmin =
    session.user.role === "ADMIN" && session.user.tenantSlug === invoice.tenant.slug;
  if (!isSuper && !isTenantAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://roadway.thronoschain.org";

  // Ensure/get Stripe customer for this tenant
  let customerId = invoice.tenant.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: invoice.tenant.name,
      metadata: { tenantSlug: invoice.tenant.slug },
    });
    customerId = customer.id;
    await prisma.partnerCompany.update({
      where: { slug: invoice.tenant.slug },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    currency: "eur",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: invoice.description,
            metadata: { invoiceNumber: invoice.number },
          },
          unit_amount: Math.round(invoice.totalEur * 100), // cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      tenantSlug: invoice.tenant.slug,
    },
    success_url: `${baseUrl}/t/${invoice.tenant.slug}/admin?invoice_paid=1`,
    cancel_url: `${baseUrl}/t/${invoice.tenant.slug}/admin`,
  });

  // Store the session ID so the webhook can find this invoice
  await prisma.tenantInvoice.update({
    where: { id: invoice.id },
    data: { stripePaymentId: checkoutSession.id, paymentMethod: "stripe" },
  });

  return NextResponse.json({ url: checkoutSession.url });
}

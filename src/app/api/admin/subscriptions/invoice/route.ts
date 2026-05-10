import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { companyId, planDays, amountEur, description } = await req.json();

  if (!companyId || !amountEur || amountEur <= 0) {
    return NextResponse.json({ message: "Invalid parameters" }, { status: 400 });
  }

  const company = await prisma.partnerCompany.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, email: true, stripeCustomerId: true, plan: true },
  });

  if (!company) {
    return NextResponse.json({ message: "Company not found" }, { status: 404 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ message: "Stripe not configured" }, { status: 500 });
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });

    let customerId = company.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      if (!company.email) {
        return NextResponse.json({ message: "Tenant has no email configured" }, { status: 400 });
      }
      const customer = await stripe.customers.create({
        name: company.name,
        email: company.email,
        metadata: { companyId: company.id, slug: company.name },
      });
      customerId = customer.id;
      await prisma.partnerCompany.update({
        where: { id: companyId },
        data: { stripeCustomerId: customerId },
      });
    }

    const invoiceDesc = description || `Συνδρομή ${company.plan} - ${company.name} (${planDays ?? 30} ημέρες)`;

    // Create Stripe invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 7,
      metadata: {
        companyId: company.id,
        planDays: String(planDays ?? 30),
        type: "subscription",
      },
    });

    // Add invoice item
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: Math.round(amountEur * 100), // in cents
      currency: "eur",
      description: invoiceDesc,
      invoice: invoice.id,
    });

    // Finalize and send the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(finalizedInvoice.id);

    // Also create a TenantInvoice record for internal tracking
    const now = new Date();
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const vatPct = 24;
    const netAmount = amountEur / (1 + vatPct / 100);

    await prisma.tenantInvoice.create({
      data: {
        tenantId: companyId,
        number: `INV-${Date.now()}`,
        description: invoiceDesc,
        amountEur: netAmount,
        vatPct,
        totalEur: amountEur,
        status: "SENT",
        dueDate,
        stripePaymentId: finalizedInvoice.id,
        paymentMethod: "STRIPE",
        lineItems: [
          {
            description: invoiceDesc,
            quantity: 1,
            unitPrice: netAmount,
            total: netAmount,
          },
        ],
      },
    });

    return NextResponse.json({
      message: "Invoice created and sent via Stripe",
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url,
      amountDue: finalizedInvoice.amount_due / 100,
    });
  } catch (error: any) {
    console.error("Stripe invoice error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import { checkPledgeStatus } from "@/lib/thronos-api";

// GET — check live pledge status from Thronos chain
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      thrWalletAddress: true,
      btcPledgeVerified: true,
      pledgeVerifiedAt: true,
      enterpriseEnabled: true,
    },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!tenant.thrWalletAddress) {
    return NextResponse.json({
      eligible: false,
      btcPledged: 0,
      minRequired: 0.011,
      thrWalletAddress: null,
      enterpriseEnabled: false,
      message: "Δεν έχει οριστεί THR wallet για τον partner.",
    });
  }

  const status = await checkPledgeStatus(tenant.thrWalletAddress);

  // Persist the verified amount and enable enterprise if newly eligible
  if (status.eligible && !tenant.enterpriseEnabled) {
    await prisma.partnerCompany.update({
      where: { id: tenant.id },
      data: {
        btcPledgeVerified: status.btcPledged,
        pledgeVerifiedAt: new Date(),
        enterpriseEnabled: true,
      },
    });
  } else if (status.btcPledged !== tenant.btcPledgeVerified) {
    await prisma.partnerCompany.update({
      where: { id: tenant.id },
      data: {
        btcPledgeVerified: status.btcPledged,
        pledgeVerifiedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ...status, enterpriseEnabled: status.eligible });
}

// POST — save the tenant's THR wallet address
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { thrWalletAddress } = await req.json();
  if (!thrWalletAddress?.startsWith("THR")) {
    return NextResponse.json(
      { error: "Μη έγκυρη THR διεύθυνση (πρέπει να ξεκινά με THR)" },
      { status: 400 }
    );
  }

  const tenant = await prisma.partnerCompany.update({
    where: { slug: params.slug },
    data: { thrWalletAddress },
  });

  return NextResponse.json({ ok: true, thrWalletAddress: tenant.thrWalletAddress });
}

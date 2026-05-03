import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { submitPledge, getPledgeVaultAddress } from "@/lib/thronos-api";

/**
 * POST /api/tenants/[slug]/pledge/submit
 * Step 1 of enterprise activation:
 *   - Partner provides their BTC address
 *   - We call /pledge_submit on the Thronos chain
 *   - Chain returns thr_address + pledge_hash + send_secret (one-time)
 *   - We store thr_address + pledge_hash on PartnerCompany
 *   - We return send_secret to the admin ONCE so they can save it
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSuper = session.user.role === "SUPER_ADMIN";
  const isTenantAdmin =
    session.user.role === "ADMIN" && session.user.tenantSlug === params.slug;
  if (!isSuper && !isTenantAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenant = await prisma.partnerCompany.findUnique({ where: { slug: params.slug } });
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const { btcAddress } = await req.json();
  if (!btcAddress || typeof btcAddress !== "string") {
    return NextResponse.json({ error: "btcAddress required" }, { status: 400 });
  }
  if (!btcAddress.match(/^[13bc][a-zA-Z0-9]{25,62}$/)) {
    return NextResponse.json({ error: "Invalid BTC address format" }, { status: 400 });
  }

  // If already has a THR address, just return the vault info
  if (tenant.thrWalletAddress && tenant.btcPledgeAddress) {
    return NextResponse.json({
      status: "already_registered",
      thrAddress: tenant.thrWalletAddress,
      pledgeVaultAddress: getPledgeVaultAddress(),
      btcPledgeAddress: tenant.btcPledgeAddress,
    });
  }

  const result = await submitPledge(btcAddress, tenant.name);
  if (!result) {
    return NextResponse.json(
      { error: "Thronos chain unreachable. Retry in a moment." },
      { status: 502 }
    );
  }

  // Persist THR address + pledge hash. Do NOT store send_secret in DB — return it once.
  await prisma.partnerCompany.update({
    where: { slug: params.slug },
    data: {
      thrWalletAddress: result.thrAddress,
      btcPledgeAddress: btcAddress,
      pledgeHash: result.pledgeHash,
    },
  });

  return NextResponse.json({
    status: result.status,
    thrAddress: result.thrAddress,
    pledgeHash: result.pledgeHash,
    pledgeVaultAddress: getPledgeVaultAddress(),
    // send_secret returned ONCE — admin must save this; it authenticates future THR sends
    sendSecret: result.sendSecret ?? null,
  });
}

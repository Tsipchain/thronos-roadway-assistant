import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import QRPrintPage from "@/components/QRPrintPage";

export default async function TenantQRPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    redirect("/login");
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: { name: true, slug: true, phone: true, logoUrl: true },
  });
  if (!tenant) notFound();

  const baseUrl =
    process.env.NEXTAUTH_URL ?? "https://roadway.thronoschain.org";
  const sosUrl = `${baseUrl}/t/${params.slug}`;

  return <QRPrintPage tenant={tenant} sosUrl={sosUrl} />;
}

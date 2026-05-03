import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomerSOS from "@/components/CustomerSOS";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug, status: "ACTIVE" },
    select: { name: true },
  });
  return {
    title: tenant ? `${tenant.name} — Οδική Βοήθεια 24/7` : "Οδική Βοήθεια",
  };
}

export default async function TenantCustomerPage({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      logoUrl: true,
      pricingRules: {
        where: { isActive: true },
        select: { serviceType: true, basePrice: true },
        orderBy: { basePrice: "asc" },
      },
    },
  });
  if (!tenant) notFound();

  return <CustomerSOS tenant={tenant} />;
}

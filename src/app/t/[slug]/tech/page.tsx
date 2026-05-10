import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TechDashboard from "./TechDashboard";

export const dynamic = "force-dynamic";

export default async function TechPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "TECHNICIAN" && session.user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }
  if (session.user.role === "TECHNICIAN" && session.user.tenantSlug !== params.slug) {
    redirect("/login");
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, slug: true, phone: true },
  });
  if (!tenant) notFound();

  const techProfile = await prisma.technicianProfile.findFirst({
    where: { userId: session.user.id },
    select: { id: true, isOnline: true, isAvailable: true, rating: true, totalJobs: true },
  });

  const [activeJobs, completedTotal, pendingJobs] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: {
        technicianId: session.user.id,
        status: { in: ["ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS"] },
      },
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle:  { select: { licensePlate: true, make: true, model: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceRequest.count({
      where: { technicianId: session.user.id, status: "COMPLETED" },
    }),
    prisma.serviceRequest.findMany({
      where: { tenantId: tenant.id, status: "PENDING", technicianId: null },
      include: {
        customer: { select: { name: true, phone: true } },
        vehicle:  { select: { licensePlate: true, make: true, model: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    }),
  ]);

  return (
    <TechDashboard
      techProfile={techProfile}
      activeJobs={activeJobs.map((j) => ({
        ...j,
        createdAt: j.createdAt.toISOString(),
        acceptedAt: j.acceptedAt?.toISOString() ?? null,
      }))}
      pendingJobs={pendingJobs.map((j) => ({
        ...j,
        createdAt: j.createdAt.toISOString(),
        acceptedAt: null,
      }))}
      completedTotal={completedTotal}
      userName={session.user.name ?? "Τεχνικός"}
      slug={params.slug}
    />
  );
}

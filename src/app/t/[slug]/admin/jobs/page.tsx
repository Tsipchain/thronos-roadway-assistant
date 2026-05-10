import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import Link from "next/link";
import JobsClient from "./JobsClient";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) redirect("/login");

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) notFound();

  const [jobs, techs] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { tenantId: tenant.id },
      include: {
        customer:   { select: { name: true, phone: true } },
        vehicle:    { select: { licensePlate: true, make: true, model: true } },
        technician: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.technicianProfile.findMany({
      where: { companyId: tenant.id },
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: [{ isOnline: "desc" }, { totalJobs: "desc" }],
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/t/${params.slug}/admin`} className="text-slate-400 hover:text-white transition text-sm">
            ← Πίσω
          </Link>
          <h1 className="text-2xl font-bold">Διαχείριση Jobs</h1>
          <span className="text-slate-500 text-sm">{tenant.name}</span>
        </div>
        <JobsClient
          slug={params.slug}
          jobs={jobs.map((j) => ({
            id:               j.id,
            status:           j.status,
            serviceType:      j.serviceType,
            latitude:         j.latitude,
            longitude:        j.longitude,
            address:          j.address,
            estimatedPrice:   j.estimatedPrice,
            estimatedMinutes: j.estimatedMinutes,
            customer:         j.customer,
            vehicle:          j.vehicle,
            technician:       j.technician,
            createdAt:        j.createdAt.toISOString(),
            acceptedAt:       j.acceptedAt?.toISOString() ?? null,
            completedAt:      j.completedAt?.toISOString() ?? null,
          }))}
          techs={techs.map((t) => ({
            userId:    t.user.id,
            name:      t.user.name,
            phone:     t.user.phone,
            isOnline:  t.isOnline,
            totalJobs: t.totalJobs,
            rating:    t.rating,
            latitude:  t.latitude,
            longitude: t.longitude,
          }))}
        />
      </div>
    </main>
  );
}

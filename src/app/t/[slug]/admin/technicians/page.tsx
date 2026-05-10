import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessTenant } from "@/lib/tenant";
import TechnicianServiceAreaAssignment from "@/components/TechnicianServiceAreaAssignment";

export const dynamic = "force-dynamic";

export default async function TechniciansPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!canAccessTenant(session.user.role, session.user.tenantSlug, params.slug)) {
    redirect("/login");
  }

  const tenant = await prisma.partnerCompany.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      serviceAreas: {
        where: { isActive: true },
        orderBy: { city: "asc" },
        select: {
          id: true,
          name: true,
          city: true,
          radiusKm: true,
          serviceTypes: true,
        },
      },
      technicians: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          serviceArea: {
            select: {
              id: true,
              name: true,
              city: true,
            },
          },
        },
        orderBy: { isOnline: "desc" },
      },
    },
  });

  if (!tenant) notFound();

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <a href={`/t/${params.slug}/admin`} className="text-slate-400 hover:text-white transition text-sm mb-2">
              ← Back to Admin
            </a>
            <h1 className="text-2xl font-bold">Technician Service Areas</h1>
            <p className="text-slate-400 text-sm mt-1">Assign service territories to technicians</p>
          </div>
        </div>

        {/* Assignment Component */}
        <TechnicianServiceAreaAssignment tenant={tenant} />

      </div>
    </main>
  );
}

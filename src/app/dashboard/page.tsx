import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { role, tenantSlug } = session.user;

  if (role === "SUPER_ADMIN") redirect("/admin");
  if (role === "ADMIN" && tenantSlug) redirect(`/t/${tenantSlug}/admin`);
  if (role === "TECHNICIAN" && tenantSlug) redirect(`/t/${tenantSlug}/tech`);

  redirect("/login");
}

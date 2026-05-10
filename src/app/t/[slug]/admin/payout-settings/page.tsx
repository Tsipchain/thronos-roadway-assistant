import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PayoutSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Only root admin can manage payouts/invoices
  if (session.user.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  return null;
}

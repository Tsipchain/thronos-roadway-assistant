"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  plan: string;
  status: string;
  createdAt: string;
  totalRequests: number;
  teamSize: number;
  totalRevenue: number;
}

export default function TenantsPage() {
  const { data: session, status } = useSession();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
    if (status === "authenticated") {
      const role = (session?.user as { role?: string })?.role;
      if (role !== "SUPER_ADMIN") {
        redirect("/admin/dashboard");
      }
      fetchCompanies();
    }
  }, [status]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/superadmin/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies);
      }
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }

  const totalRevenue = companies.reduce((s, c) => s + c.totalRevenue, 0);
  const totalRequests = companies.reduce((s, c) => s + c.totalRequests, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
              THRONOS ROOT ADMIN
            </div>
            <h1 className="text-3xl font-bold">All Tenants</h1>
            <p className="text-gray-600 mt-1">{companies.length} partner companies on platform</p>
          </div>
          <div className="space-x-4">
            <Link
              href="/admin/tenants/new"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition text-sm"
            >
              + New Tenant
            </Link>
          </div>
        </div>

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Tenants", value: companies.length, color: "text-blue-600" },
            { label: "Active", value: companies.filter((c) => c.status === "ACTIVE").length, color: "text-green-600" },
            { label: "Total Requests", value: totalRequests, color: "text-orange-600" },
            { label: "Platform Revenue", value: `€${totalRevenue.toFixed(0)}`, color: "text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">{s.label}</div>
              <div className={`mt-2 text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Companies Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Company</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Plan</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Team</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Requests</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Revenue</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No tenants yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-sm text-gray-500">/t/{c.slug}</div>
                      {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-semibold uppercase">
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded font-semibold ${
                          c.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold">{c.teamSize}</td>
                    <td className="px-6 py-4 text-right font-semibold">{c.totalRequests}</td>
                    <td className="px-6 py-4 text-right font-semibold text-green-700">
                      €{c.totalRevenue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/t/${c.slug}/admin`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Credentials reminder */}
        <div className="mt-8 bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm">
          <div className="font-semibold text-purple-800 mb-2">Root Access Info</div>
          <div className="text-purple-700 space-y-1">
            <div>Super Admin: <code className="bg-white px-1 rounded">admin@thronoschain.com</code> / <code className="bg-white px-1 rounded">ThrAdmin2025!</code></div>
            <div>LK Shop Admin: <code className="bg-white px-1 rounded">admin@lkshop.gr</code> / <code className="bg-white px-1 rounded">LKAdmin2025!</code></div>
            <div>Technicians: <code className="bg-white px-1 rounded">tech1@lkshop.gr</code> … <code className="bg-white px-1 rounded">tech5@lkshop.gr</code> / <code className="bg-white px-1 rounded">Tech2025!</code></div>
          </div>
        </div>
      </div>
    </div>
  );
}

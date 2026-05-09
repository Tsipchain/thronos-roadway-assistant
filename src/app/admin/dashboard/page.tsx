"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface Metrics {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  totalRevenue: number;
  averageRating: number;
  teamSize: number;
  revenueByDay: Array<{ date: string; revenue: number }>;
  topTechnicians: Array<{ id: string; name: string; completedJobs: number; rating: number }>;
  customerSatisfaction: number;
}

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchMetrics();
    }
  }, [status]);

  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/admin/analytics?metric=overview");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  if (!metrics) {
    return <div>Failed to load dashboard</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome, {session?.user?.name}</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Total Requests</div>
            <div className="mt-2 text-3xl font-bold">{metrics.totalRequests}</div>
            <div className="mt-2 text-sm text-gray-500">
              {metrics.pendingRequests} pending
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Completed</div>
            <div className="mt-2 text-3xl font-bold">{metrics.completedRequests}</div>
            <div className="mt-2 text-sm text-gray-500">
              {metrics.totalRequests > 0
                ? Math.round(
                    (metrics.completedRequests / metrics.totalRequests) * 100
                  )
                : 0}
              % completion
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Revenue</div>
            <div className="mt-2 text-3xl font-bold">€{metrics.totalRevenue.toFixed(2)}</div>
            <div className="mt-2 text-sm text-gray-500">
              {metrics.totalRevenue > 0
                ? (metrics.totalRevenue / metrics.totalRequests).toFixed(2)
                : 0}
              € per request
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600">Team Size</div>
            <div className="mt-2 text-3xl font-bold">{metrics.teamSize}</div>
            <div className="mt-2 text-sm text-gray-500">Technicians</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link
            href="/admin/team"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg transition"
          >
            <div className="text-2xl mb-2">👥</div>
            <div className="font-semibold text-sm">Manage Team</div>
          </Link>

          <Link
            href="/admin/requests"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg transition"
          >
            <div className="text-2xl mb-2">📋</div>
            <div className="font-semibold text-sm">Requests</div>
          </Link>

          <Link
            href="/admin/analytics"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg transition"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-semibold text-sm">Analytics</div>
          </Link>

          <Link
            href="/admin/pricing"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-lg transition"
          >
            <div className="text-2xl mb-2">💰</div>
            <div className="font-semibold text-sm">Pricing</div>
          </Link>

          {(session?.user as { role?: string })?.role === "SUPER_ADMIN" && (
            <Link
              href="/admin/tenants"
              className="bg-purple-600 rounded-lg shadow p-4 text-center hover:shadow-lg transition col-span-2 md:col-span-4"
            >
              <div className="text-2xl mb-2">🏢</div>
              <div className="font-semibold text-sm text-white">All Tenants (Root Admin)</div>
            </Link>
          )}
        </div>

        {/* Revenue Chart */}
        {metrics.revenueByDay.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Revenue Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  name="Daily Revenue (€)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Technicians */}
        {metrics.topTechnicians.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Top Technicians</h2>
            <div className="space-y-4">
              {metrics.topTechnicians.map((tech) => (
                <div key={tech.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-semibold">{tech.name}</div>
                    <div className="text-sm text-gray-600">
                      {tech.completedJobs} completed jobs
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">⭐ {tech.rating.toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

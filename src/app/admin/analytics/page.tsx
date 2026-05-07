"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Analytics {
  period: string;
  totalRequests: number;
  completedRequests: number;
  completionRate: number;
  avgCompletionTimeMinutes: number;
  totalRevenue: number;
  avgRevenuePerRequest: number;
  customerSatisfaction: number;
  uniqueCustomers: number;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchAnalytics();
    }
  }, [status]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics?metric=detailed");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  if (!analytics) {
    return <div>Failed to load analytics</div>;
  }

  const metricCards = [
    {
      title: "Total Requests",
      value: analytics.totalRequests,
      icon: "📋",
    },
    {
      title: "Completion Rate",
      value: `${analytics.completionRate.toFixed(1)}%`,
      icon: "✅",
    },
    {
      title: "Avg Completion Time",
      value: `${analytics.avgCompletionTimeMinutes}m`,
      icon: "⏱️",
    },
    {
      title: "Total Revenue",
      value: `€${analytics.totalRevenue.toFixed(2)}`,
      icon: "💰",
    },
    {
      title: "Avg Revenue/Request",
      value: `€${analytics.avgRevenuePerRequest.toFixed(2)}`,
      icon: "💵",
    },
    {
      title: "Customer Satisfaction",
      value: `${analytics.customerSatisfaction.toFixed(1)}/5`,
      icon: "⭐",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-gray-600 mt-2">Last 30 days performance</p>
          </div>
          <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
            ← Back
          </Link>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {metricCards.map((metric) => (
            <div key={metric.title} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-600">{metric.title}</div>
                  <div className="mt-2 text-3xl font-bold">{metric.value}</div>
                </div>
                <div className="text-3xl">{metric.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Request Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Completed</span>
                <span className="font-semibold">{analytics.completedRequests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pending</span>
                <span className="font-semibold">
                  {analytics.totalRequests - analytics.completedRequests}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unique Customers</span>
                <span className="font-semibold">{analytics.uniqueCustomers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg Rating</span>
                <span className="font-semibold">
                  {(analytics.customerSatisfaction / 20).toFixed(1)}/5 ⭐
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Revenue Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Revenue</span>
                <span className="font-semibold">€{analytics.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Avg per Request</span>
                <span className="font-semibold">
                  €{analytics.avgRevenuePerRequest.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Daily Average</span>
                <span className="font-semibold">
                  €{(analytics.totalRevenue / 30).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Completed Requests</span>
                <span className="font-semibold">{analytics.completedRequests}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Indicators */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-6">Key Performance Indicators</h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Completion Rate</span>
                <span className="text-sm font-semibold">
                  {analytics.completionRate.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${analytics.completionRate}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Customer Satisfaction</span>
                <span className="text-sm font-semibold">
                  {analytics.customerSatisfaction.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${analytics.customerSatisfaction}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">
                Avg Completion Time: {analytics.avgCompletionTimeMinutes} minutes
              </div>
              <div className="text-xs text-gray-600">
                Target: &lt; 45 minutes from dispatch to completion
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

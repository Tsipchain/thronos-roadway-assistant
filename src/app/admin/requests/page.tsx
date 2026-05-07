"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface Request {
  id: string;
  status: string;
  serviceType: string;
  customer: { name: string; phone: string };
  technician?: { name: string; phone: string } | null;
  createdAt: string;
  completedAt?: string;
  estimatedPrice?: number;
  finalPrice?: number;
}

export default function RequestsPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchRequests();
    }
  }, [status, filter]);

  const fetchRequests = async () => {
    try {
      const url =
        filter === "all"
          ? "/api/admin/requests"
          : `/api/admin/requests?status=${filter}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: "bg-yellow-100 text-yellow-800",
      ACCEPTED: "bg-blue-100 text-blue-800",
      EN_ROUTE: "bg-purple-100 text-purple-800",
      ARRIVED: "bg-indigo-100 text-indigo-800",
      IN_PROGRESS: "bg-orange-100 text-orange-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Service Requests</h1>
            <p className="text-gray-600 mt-2">{requests.length} requests found</p>
          </div>
          <Link
            href="/admin/dashboard"
            className="text-blue-600 hover:underline"
          >
            ← Back
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {["all", "PENDING", "ACCEPTED", "IN_PROGRESS", "COMPLETED"].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg transition ${
                  filter === status
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                {status === "all" ? "All Requests" : status}
              </button>
            ))}
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {requests.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No requests found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Customer</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Service</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Technician</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Price</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">
                      <Link
                        href={`/admin/request/${req.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {req.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium">{req.customer.name}</div>
                      <div className="text-gray-600 text-xs">{req.customer.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">{req.serviceType}</td>
                    <td className="px-6 py-4 text-sm">
                      {req.technician ? (
                        <div>
                          <div className="font-medium">{req.technician.name}</div>
                          <div className="text-gray-600 text-xs">{req.technician.phone}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">
                      €{(req.finalPrice || req.estimatedPrice || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

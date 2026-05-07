"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import NextDynamic from "next/dynamic";

// Leaflet must be loaded only client-side (uses window)
const MapContainer = NextDynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = NextDynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = NextDynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = NextDynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

interface LiveRequest {
  id: string;
  status: string;
  serviceType: string;
  latitude: number;
  longitude: number;
  customer: { name: string; phone: string };
  technician?: { name: string; phone: string } | null;
  createdAt: string;
  estimatedMinutes?: number;
}

interface LiveTechnician {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isOnline: boolean;
  isAvailable: boolean;
  rating: number;
  totalJobs: number;
}

export default function LiveDispatchPage() {
  const { data: session, status } = useSession();
  const [requests, setRequests] = useState<LiveRequest[]>([]);
  const [technicians, setTechnicians] = useState<LiveTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }
    if (status === "authenticated") {
      fetchLiveData();
    }
  }, [status]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLiveData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const fetchLiveData = async () => {
    try {
      const [requestsRes, techsRes] = await Promise.all([
        fetch("/api/admin/live/requests"),
        fetch("/api/admin/live/technicians"),
      ]);
      if (requestsRes.ok) setRequests((await requestsRes.json()).requests);
      if (techsRes.ok) setTechnicians((await techsRes.json()).technicians);
    } catch (error) {
      console.error("Failed to fetch live data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (s: string) =>
    ({
      PENDING: "#FCD34D",
      ACCEPTED: "#3B82F6",
      EN_ROUTE: "#8B5CF6",
      ARRIVED: "#6366F1",
      IN_PROGRESS: "#F97316",
      COMPLETED: "#10B981",
    }[s] || "#6B7280");

  if (status === "loading" || loading) return <div>Loading...</div>;

  const activeRequests = requests.filter((r) => r.status !== "COMPLETED");
  const onlineTechs = technicians.filter((t) => t.isOnline);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Live Dispatch</h1>
            <p className="text-gray-600 mt-2">Real-time request and technician tracking</p>
          </div>
          <div className="space-x-4">
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
              ← Dashboard
            </Link>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`font-semibold py-2 px-4 rounded-lg transition ${
                autoRefresh ? "bg-green-600 text-white" : "bg-gray-200"
              }`}
            >
              {autoRefresh ? "🔄 Live" : "Paused"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active", value: activeRequests.length, color: "text-yellow-600" },
            { label: "Online Techs", value: onlineTechs.length, color: "text-blue-600" },
            { label: "Pending", value: requests.filter((r) => r.status === "PENDING").length, color: "text-orange-600" },
            { label: "In Progress", value: requests.filter((r) => r.status === "IN_PROGRESS").length, color: "text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">{s.label}</div>
              <div className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Map + List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden" style={{ height: 400 }}>
            <MapContainer center={[37.9838, 23.7275]} zoom={11} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {activeRequests.map((req) => (
                <Marker key={req.id} position={[req.latitude, req.longitude]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{req.customer.name}</div>
                      <div>{req.serviceType}</div>
                      <div
                        className="mt-1 px-1 rounded text-xs text-white inline-block"
                        style={{ backgroundColor: getStatusColor(req.status) }}
                      >
                        {req.status}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b font-semibold">Active Requests</div>
            <div className="overflow-y-auto flex-1">
              {activeRequests.length === 0 ? (
                <div className="p-4 text-center text-gray-600 text-sm">No active requests</div>
              ) : (
                activeRequests.map((req) => (
                  <div key={req.id} className="p-4 border-b hover:bg-gray-50">
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-semibold text-sm">{req.customer.name}</div>
                      <span
                        className="text-xs px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: getStatusColor(req.status) }}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">{req.serviceType}</div>
                    {req.technician && (
                      <div className="text-xs text-gray-500 mt-1">→ {req.technician.name}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

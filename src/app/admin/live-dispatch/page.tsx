"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

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
      if (autoRefresh) {
        const interval = setInterval(fetchLiveData, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [status, autoRefresh]);

  const fetchLiveData = async () => {
    try {
      const [requestsRes, techsRes] = await Promise.all([
        fetch("/api/admin/live/requests"),
        fetch("/api/admin/live/technicians"),
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data.requests);
      }

      if (techsRes.ok) {
        const data = await techsRes.json();
        setTechnicians(data.technicians);
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch live data:", error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      PENDING: "#FCD34D",
      ACCEPTED: "#3B82F6",
      EN_ROUTE: "#8B5CF6",
      ARRIVED: "#6366F1",
      IN_PROGRESS: "#F97316",
      COMPLETED: "#10B981",
    };
    return colors[status] || "#6B7280";
  };

  const requestIcon = (status: string) => {
    return L.circleMarker(undefined, {
      radius: 8,
      fillColor: getStatusColor(status),
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    });
  };

  const techIcon = L.icon({
    iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%234F46E5'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

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
                autoRefresh
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {autoRefresh ? "🔄 Auto-refresh ON" : "Paused"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Active Requests</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">
              {activeRequests.length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Online Technicians</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">
              {onlineTechs.length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">Pending Dispatch</div>
            <div className="mt-2 text-3xl font-bold text-orange-600">
              {requests.filter((r) => r.status === "PENDING").length}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-600">In Progress</div>
            <div className="mt-2 text-3xl font-bold text-purple-600">
              {requests.filter((r) => r.status === "IN_PROGRESS").length}
            </div>
          </div>
        </div>

        {/* Map and List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden h-96">
            <MapContainer center={[37.9838, 23.7275]} zoom={11} style={{ height: "100%" }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />

              {/* Request Markers */}
              {activeRequests.map((req) => (
                <Marker
                  key={req.id}
                  position={[req.latitude, req.longitude]}
                  icon={requestIcon(req.status)}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{req.customer.name}</div>
                      <div className="text-gray-600">{req.serviceType}</div>
                      <div className="text-xs font-mono">{req.status}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Technician Markers */}
              {onlineTechs.map((tech) => (
                <Marker
                  key={tech.id}
                  position={[tech.latitude, tech.longitude]}
                  icon={techIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{tech.name}</div>
                      <div className="text-gray-600">⭐ {tech.rating.toFixed(1)}</div>
                      <div className="text-xs">
                        {tech.totalJobs} jobs • {tech.isAvailable ? "Available" : "Busy"}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Active Requests List */}
          <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-4 border-b font-semibold">Active Requests</div>
            <div className="overflow-y-auto flex-1">
              {activeRequests.length === 0 ? (
                <div className="p-4 text-center text-gray-600">No active requests</div>
              ) : (
                activeRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 border-b hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-sm">{req.customer.name}</div>
                      <span
                        className="text-xs px-2 py-1 rounded text-white"
                        style={{ backgroundColor: getStatusColor(req.status) }}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      <div>{req.serviceType}</div>
                      {req.technician && (
                        <div className="mt-1">Assigned: {req.technician.name}</div>
                      )}
                      {req.estimatedMinutes && (
                        <div className="mt-1">ETA: {req.estimatedMinutes}m</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Status Legend */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <div className="text-sm font-semibold mb-3">Status Legend</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Pending", color: "#FCD34D" },
              { label: "Accepted", color: "#3B82F6" },
              { label: "En Route", color: "#8B5CF6" },
              { label: "Arrived", color: "#6366F1" },
              { label: "In Progress", color: "#F97316" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  style={{ backgroundColor: item.color }}
                  className="w-4 h-4 rounded-full border"
                ></div>
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

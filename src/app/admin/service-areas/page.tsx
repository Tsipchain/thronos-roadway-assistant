"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface ServiceArea {
  id: string;
  name: string;
  city: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusKm: number;
  serviceTypes: string[];
  slaMinutes: number;
  isActive: boolean;
}

const SERVICE_TYPES = [
  "BATTERY_REPLACEMENT",
  "BATTERY_CHARGE",
  "TIRE_CHANGE",
  "TIRE_REPAIR",
  "DIAGNOSIS",
];

export default function ServiceAreasPage() {
  const { data: session, status } = useSession();
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    centerLatitude: "",
    centerLongitude: "",
    radiusKm: "15",
    serviceTypes: [] as string[],
    slaMinutes: "30",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchAreas();
    }
  }, [status]);

  const fetchAreas = async () => {
    try {
      const res = await fetch("/api/admin/service-areas");
      if (res.ok) {
        const data = await res.json();
        setAreas(data.areas);
      }
    } catch (error) {
      console.error("Failed to fetch service areas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.city) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const res = await fetch("/api/admin/service-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchAreas();
        setShowForm(false);
        setFormData({
          name: "",
          city: "",
          centerLatitude: "",
          centerLongitude: "",
          radiusKm: "15",
          serviceTypes: [],
          slaMinutes: "30",
        });
      }
    } catch (error) {
      console.error("Failed to save service area:", error);
    }
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm("Delete this service area?")) return;

    try {
      await fetch("/api/admin/service-areas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId }),
      });

      await fetchAreas();
    } catch (error) {
      console.error("Failed to delete service area:", error);
    }
  };

  const toggleServiceType = (type: string) => {
    setFormData({
      ...formData,
      serviceTypes: formData.serviceTypes.includes(type)
        ? formData.serviceTypes.filter((t) => t !== type)
        : [...formData.serviceTypes, type],
    });
  };

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Service Areas</h1>
            <p className="text-gray-600 mt-2">Manage geographic coverage zones</p>
          </div>
          <div className="space-x-4">
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
              ← Back
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {showForm ? "Cancel" : "+ Add Area"}
            </button>
          </div>
        </div>

        {/* Add Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Add Service Area</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Area Name*</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg p-2"
                  placeholder="e.g., Downtown Athens"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">City*</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full border rounded-lg p-2"
                  placeholder="e.g., Athens"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Radius (km)</label>
                <input
                  type="number"
                  value={formData.radiusKm}
                  onChange={(e) => setFormData({ ...formData, radiusKm: e.target.value })}
                  className="w-full border rounded-lg p-2"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Center Latitude</label>
                <input
                  type="number"
                  value={formData.centerLatitude}
                  onChange={(e) =>
                    setFormData({ ...formData, centerLatitude: e.target.value })
                  }
                  className="w-full border rounded-lg p-2"
                  step="0.0001"
                  placeholder="e.g., 37.9838"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Center Longitude</label>
                <input
                  type="number"
                  value={formData.centerLongitude}
                  onChange={(e) =>
                    setFormData({ ...formData, centerLongitude: e.target.value })
                  }
                  className="w-full border rounded-lg p-2"
                  step="0.0001"
                  placeholder="e.g., 23.7275"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">SLA (minutes)</label>
                <input
                  type="number"
                  value={formData.slaMinutes}
                  onChange={(e) => setFormData({ ...formData, slaMinutes: e.target.value })}
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-2">Service Types</label>
                <div className="grid grid-cols-2 gap-2">
                  {SERVICE_TYPES.map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.serviceTypes.includes(type)}
                        onChange={() => toggleServiceType(type)}
                        className="mr-2"
                      />
                      <span className="text-sm">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Create Area
              </button>
            </form>
          </div>
        )}

        {/* Areas List */}
        <div className="grid gap-4">
          {areas.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
              No service areas found
            </div>
          ) : (
            areas.map((area) => (
              <div key={area.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{area.name}</h3>
                    <p className="text-gray-600">{area.city}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(area.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs font-medium text-gray-600">Radius</div>
                    <div className="text-lg font-semibold">{area.radiusKm}km</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600">SLA</div>
                    <div className="text-lg font-semibold">{area.slaMinutes}min</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600">Latitude</div>
                    <div className="text-sm font-mono">{area.centerLatitude.toFixed(4)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600">Longitude</div>
                    <div className="text-sm font-mono">{area.centerLongitude.toFixed(4)}</div>
                  </div>
                </div>

                {area.serviceTypes.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-2">Services</div>
                    <div className="flex flex-wrap gap-2">
                      {area.serviceTypes.map((type) => (
                        <span
                          key={type}
                          className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

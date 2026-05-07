"use client";
export const dynamic = 'force-dynamic';

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface PricingRule {
  id: string;
  serviceType: string;
  basePrice: number;
  perKmSurcharge: number;
  nightSurcharge: number;
  weekendSurcharge: number;
}

const SERVICE_TYPES = [
  "BATTERY_REPLACEMENT",
  "BATTERY_CHARGE",
  "TIRE_CHANGE",
  "TIRE_REPAIR",
  "DIAGNOSIS",
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    serviceType: "BATTERY_REPLACEMENT",
    basePrice: 50,
    perKmSurcharge: 0.5,
    nightSurcharge: 10,
    weekendSurcharge: 5,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/auth/signin");
    }

    if (status === "authenticated") {
      fetchRules();
    }
  }, [status]);

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/admin/pricing");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules);
      }
    } catch (error) {
      console.error("Failed to fetch pricing rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchRules();
        setShowForm(false);
        setEditingId(null);
        setFormData({
          serviceType: "BATTERY_REPLACEMENT",
          basePrice: 50,
          perKmSurcharge: 0.5,
          nightSurcharge: 10,
          weekendSurcharge: 5,
        });
      }
    } catch (error) {
      console.error("Failed to save pricing rule:", error);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Delete this pricing rule?")) return;

    try {
      await fetch("/api/admin/pricing", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      });

      await fetchRules();
    } catch (error) {
      console.error("Failed to delete pricing rule:", error);
    }
  };

  if (status === "loading" || loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Pricing Rules</h1>
            <p className="text-gray-600 mt-2">Manage service pricing by type</p>
          </div>
          <div className="space-x-4">
            <Link href="/admin/dashboard" className="text-blue-600 hover:underline">
              ← Back
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              {showForm ? "Cancel" : "+ Add Rule"}
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? "Edit Pricing Rule" : "Add Pricing Rule"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Service Type</label>
                <select
                  value={formData.serviceType}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceType: e.target.value })
                  }
                  className="w-full border rounded-lg p-2"
                >
                  {SERVICE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Base Price (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.basePrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      basePrice: parseFloat(e.target.value),
                    })
                  }
                  className="w-full border rounded-lg p-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Per KM Surcharge (€/km)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.perKmSurcharge}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      perKmSurcharge: parseFloat(e.target.value),
                    })
                  }
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Night Surcharge (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.nightSurcharge}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nightSurcharge: parseFloat(e.target.value),
                    })
                  }
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">
                  Weekend Surcharge (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.weekendSurcharge}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      weekendSurcharge: parseFloat(e.target.value),
                    })
                  }
                  className="w-full border rounded-lg p-2"
                />
              </div>

              <button
                type="submit"
                className="col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
              >
                Save Rule
              </button>
            </form>
          </div>
        )}

        {/* Rules Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {rules.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No pricing rules found</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Service</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Base Price</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Per KM</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Night</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Weekend</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{rule.serviceType}</td>
                    <td className="px-6 py-4">€{rule.basePrice.toFixed(2)}</td>
                    <td className="px-6 py-4">€{rule.perKmSurcharge.toFixed(2)}/km</td>
                    <td className="px-6 py-4">€{rule.nightSurcharge.toFixed(2)}</td>
                    <td className="px-6 py-4">€{rule.weekendSurcharge.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Delete
                      </button>
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

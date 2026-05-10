"use client";

import { useState } from "react";

interface ServiceArea {
  id: string;
  name: string;
  city: string;
  radiusKm: number;
  serviceTypes: string[];
}

interface Technician {
  id: string;
  userId: string;
  isOnline: boolean;
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  serviceArea: {
    id: string;
    name: string;
    city: string;
  } | null;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  serviceAreas: ServiceArea[];
  technicians: Technician[];
}

interface Assignment {
  [technicianId: string]: string | null;
}

export default function TechnicianServiceAreaAssignment({ tenant }: { tenant: Tenant }) {
  const [assignments, setAssignments] = useState<Assignment>(
    tenant.technicians.reduce((acc, tech) => ({
      ...acc,
      [tech.id]: tech.serviceArea?.id ?? null,
    }), {})
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [changedTechs, setChangedTechs] = useState<Set<string>>(new Set());

  const handleAssignment = (technicianId: string, areaId: string | null) => {
    const original = tenant.technicians.find(t => t.id === technicianId)?.serviceArea?.id ?? null;

    setAssignments(prev => ({
      ...prev,
      [technicianId]: areaId,
    }));

    if (areaId === original) {
      setChangedTechs(prev => {
        const newSet = new Set(prev);
        newSet.delete(technicianId);
        return newSet;
      });
    } else {
      setChangedTechs(prev => new Set(prev).add(technicianId));
    }
  };

  const handleSave = async () => {
    if (changedTechs.size === 0) {
      setMessage("No changes to save");
      return;
    }

    setSaving(true);
    setMessage("");

    const updates = Array.from(changedTechs).map(techId => ({
      technicianId: techId,
      serviceAreaId: assignments[techId] || null,
    }));

    try {
      const response = await fetch(`/api/t/${tenant.slug}/technicians/service-areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments: updates }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✓ Updated ${changedTechs.size} technician(s) successfully`);
        setChangedTechs(new Set());
      } else {
        setMessage(`✗ Error: ${data.message || "Failed to save"}`);
      }
    } catch (error) {
      setMessage("✗ Failed to save assignments");
    } finally {
      setSaving(false);
    }
  };

  const unassignedCount = tenant.technicians.filter(t => !assignments[t.id]).length;

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-xs">Total Technicians</div>
          <div className="text-2xl font-bold mt-1">{tenant.technicians.length}</div>
        </div>
        <div className={`rounded-2xl p-4 border ${unassignedCount > 0 ? "bg-amber-500/10 border-amber-500/30" : "bg-green-500/10 border-green-500/30"}`}>
          <div className={`text-xs ${unassignedCount > 0 ? "text-amber-400" : "text-green-400"}`}>Unassigned</div>
          <div className="text-2xl font-bold mt-1">{unassignedCount}</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-slate-400 text-xs">Service Areas</div>
          <div className="text-2xl font-bold mt-1">{tenant.serviceAreas.length}</div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700 text-sm">
          {message}
        </div>
      )}

      {/* Service Areas Info */}
      {tenant.serviceAreas.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-amber-300 font-medium">No Service Areas Configured</p>
          <p className="text-sm text-slate-400 mt-2">
            You need to create service areas first before assigning technicians.
          </p>
        </div>
      ) : null}

      {/* Technicians Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-semibold mb-6">Assign Service Areas</h2>

        {tenant.technicians.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">👥</div>
            <p>No technicians yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-white/10 text-left">
                    <th className="pb-3">Technician</th>
                    <th className="pb-3">Phone</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Current Area</th>
                    <th className="pb-3">Assign To</th>
                  </tr>
                </thead>
                <tbody>
                  {tenant.technicians.map((tech) => {
                    const currentAssignment = assignments[tech.id];
                    const hasChanged = tech.serviceArea?.id !== currentAssignment && (currentAssignment !== null || tech.serviceArea !== null);

                    return (
                      <tr
                        key={tech.id}
                        className={`border-b border-white/5 hover:bg-white/5 transition ${
                          hasChanged ? "bg-indigo-500/5" : ""
                        }`}
                      >
                        <td className="py-4 font-medium">{tech.user.name}</td>
                        <td className="py-4 text-slate-400 text-xs">{tech.user.phone || "-"}</td>
                        <td className="py-4">
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              tech.isOnline
                                ? "bg-green-500/20 text-green-300"
                                : "bg-slate-500/20 text-slate-400"
                            }`}
                          >
                            {tech.isOnline ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="py-4 text-slate-400">
                          {tech.serviceArea ? (
                            <div>
                              <div className="text-sm">{tech.serviceArea.name}</div>
                              <div className="text-xs text-slate-500">{tech.serviceArea.city}</div>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-4">
                          <select
                            value={currentAssignment || ""}
                            onChange={(e) => handleAssignment(tech.id, e.target.value || null)}
                            className={`bg-slate-800 border rounded-lg px-3 py-2 text-sm focus:outline-none transition ${
                              hasChanged
                                ? "border-indigo-500 focus:border-indigo-400"
                                : "border-white/10 focus:border-white/30"
                            }`}
                          >
                            <option value="">-- Unassigned --</option>
                            {tenant.serviceAreas.map((area) => (
                              <option key={area.id} value={area.id}>
                                {area.name} ({area.city})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={changedTechs.size === 0 || saving}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                {saving ? "Saving..." : `Save Changes (${changedTechs.size})`}
              </button>
              {changedTechs.size > 0 && (
                <p className="text-sm text-slate-400">
                  {changedTechs.size} technician(s) with pending changes
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
        <div className="text-xs text-slate-400 space-y-1">
          <p className="font-medium text-slate-300 mb-2">About Service Areas:</p>
          <ul className="space-y-1 ml-4">
            <li>• Each technician is assigned to ONE service area (territory)</li>
            <li>• They will only receive dispatch requests within their assigned area's radius</li>
            <li>• Unassigned technicians won't appear in dispatch matching</li>
            <li>• Service areas define coverage zones, SLAs, and available services</li>
          </ul>
        </div>
      </div>

    </div>
  );
}

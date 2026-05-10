"use client";
import { useState } from "react";
import Link from "next/link";

type ServiceArea = { id: string; name: string; city: string; radiusKm: number };

type Tech = {
  id: string; userId: string; isOnline: boolean;
  isAvailable: boolean; totalJobs: number;
  serviceAreaId: string | null;
  user: { id: string; name: string; email: string; phone: string | null };
};

function LimitBar({ current, max }: { current: number; max: number }) {
  const unlimited = max === -1;
  const pct = unlimited ? 0 : Math.round((current / max) * 100);
  const isWarning = !unlimited && pct >= 80;
  const isAtMax  = !unlimited && current >= max;
  return (
    <div className={`rounded-xl border p-4 mb-6 ${
      isAtMax ? "bg-red-500/10 border-red-500/30" :
      isWarning ? "bg-amber-500/10 border-amber-500/30" :
      "bg-white/5 border-white/10"
    }`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">Τεχνικοί</span>
        <span className={`text-sm font-bold ${
          isAtMax ? "text-red-300" : isWarning ? "text-amber-300" : "text-slate-300"
        }`}>
          {current}{unlimited ? "" : ` / ${max}`}
          {unlimited && <span className="text-xs text-slate-400 ml-1">(unlimited)</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isAtMax ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-purple-500"
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
      {isAtMax && (
        <p className="text-xs text-red-300 mt-2">
          Έχετε φτάσει το όριο. Ζητήστε αναβάθμιση σε Pro ή Enterprise από τον διαχειριστή.
        </p>
      )}
    </div>
  );
}

export default function TeamClient({
  tenantId, tenantSlug, technicians: initial, serviceAreas, planLabel, maxTechnicians,
}: {
  tenantId: string; tenantSlug: string; technicians: Tech[];
  serviceAreas: ServiceArea[];
  planLabel: string; maxTechnicians: number;
}) {
  const [techs, setTechs] = useState<Tech[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: "", phone: "", email: "", serviceAreaId: "" });
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState<{ techId: string; password: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addData, setAddData] = useState({ name: "", phone: "", email: "", password: "" });
  const [addingTech, setAddingTech] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const atLimit = maxTechnicians !== -1 && techs.length >= maxTechnicians;

  const startEdit = (tech: Tech) => {
    setEditing(tech.id);
    setEditData({ name: tech.user.name, phone: tech.user.phone ?? "", email: tech.user.email, serviceAreaId: tech.serviceAreaId ?? "" });
    setNewPassword(null); setMsg(null);
  };

  const saveEdit = async (tech: Tech) => {
    setSaving(true);
    const res = await fetch(`/api/t/${tenantSlug}/team/${tech.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editData.name,
        phone: editData.phone,
        email: editData.email,
        serviceAreaId: editData.serviceAreaId || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setTechs((p) => p.map((t) => t.id === tech.id
        ? { ...t, serviceAreaId: editData.serviceAreaId || null, user: { ...t.user, name: editData.name, phone: editData.phone, email: editData.email } }
        : t
      ));
      setEditing(null);
      setMsg("✅ Στοιχεία ενημερώθηκαν");
    } else { setMsg("❌ Σφάλμα αποθήκευσης"); }
  };

  const resetPassword = async (tech: Tech) => {
    if (!confirm(`Επαναφορά κωδικού για ${tech.user.name};`)) return;
    setSaving(true);
    const res = await fetch(`/api/t/${tenantSlug}/team/${tech.id}/reset-password`, { method: "POST" });
    setSaving(false);
    if (res.ok) { const d = await res.json(); setNewPassword({ techId: tech.id, password: d.newPassword }); }
    else { setMsg("❌ Σφάλμα επαναφοράς"); }
  };

  const addTechnician = async () => {
    if (!addData.name || !addData.phone || !addData.password) return;
    setAddingTech(true); setMsg(null);
    const res = await fetch(`/api/t/${tenantSlug}/team`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...addData, tenantId }),
    });
    setAddingTech(false);
    if (res.ok) {
      const newTech = await res.json();
      setTechs((p) => [...p, newTech]);
      setShowAdd(false);
      setAddData({ name: "", phone: "", email: "", password: "" });
      setMsg("✅ Τεχνικός προστέθηκε!");
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg(`❌ ${err.error ?? "Σφάλμα"}`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 text-sm">
            <Link href={`/t/${tenantSlug}/admin`} className="text-slate-400 hover:text-white transition">← Admin</Link>
            <span className="text-slate-600">/</span>
            <h1 className="text-xl font-bold">👥 Ομάδα</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-white/5 px-2.5 py-1 rounded-full">{planLabel}</span>
            {!atLimit && (
              <button
                onClick={() => { setShowAdd(!showAdd); setMsg(null); }}
                className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
              >
                {showAdd ? "Άκυρο" : "+ Νέος"}
              </button>
            )}
          </div>
        </div>

        <LimitBar current={techs.length} max={maxTechnicians} />

        {msg && (
          <div className={`text-sm rounded-xl px-4 py-3 mb-4 ${
            msg.startsWith("✅") ? "bg-green-500/10 border border-green-500/20 text-green-300" : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}>{msg}</div>
        )}

        {showAdd && !atLimit && (
          <div className="bg-white/5 border border-purple-500/30 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold mb-4">Νέος Τεχνικός</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Ονοματεπώνυμο *</label>
                <input value={addData.name} onChange={(e) => setAddData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Νίκος Παπαδόπουλος"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Τηλέφωνο *</label>
                <input type="tel" value={addData.phone} onChange={(e) => setAddData((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="69XXXXXXXX"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email (προαιρετικό)</label>
                <input type="email" value={addData.email} onChange={(e) => setAddData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="tech@email.com"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Αρχικός Κωδικός *</label>
                <input type="text" value={addData.password} onChange={(e) => setAddData((p) => ({ ...p, password: e.target.value }))}
                  placeholder="π.χ. lkshop2026"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition" />
              </div>
            </div>
            <button onClick={addTechnician} disabled={addingTech || !addData.name || !addData.phone || !addData.password}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition">
              {addingTech ? "Προσθήκη..." : "Προσθήκη Τεχνικού"}
            </button>
          </div>
        )}

        <div className="space-y-3">
          {techs.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">👷</div>
              <p>Δεν υπάρχουν τεχνικοί ακόμα.</p>
            </div>
          )}
          {techs.map((tech) => (
            <div key={tech.id} className={`bg-white/5 border rounded-2xl p-5 transition ${
              editing === tech.id ? "border-purple-500/50" : "border-white/10"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center text-lg font-bold shrink-0">
                    {tech.user.name[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {tech.user.name}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tech.isOnline ? "bg-green-500/20 text-green-300" : "bg-slate-500/20 text-slate-400"
                      }`}>{tech.isOnline ? "Online" : "Offline"}</span>
                    </div>
                    <div className="text-sm text-slate-400">{tech.user.phone}</div>
                    <div className="text-xs text-slate-500">{tech.user.email}</div>
                    <div className="text-xs mt-1">
                      {tech.serviceAreaId
                        ? (() => {
                            const area = serviceAreas.find(a => a.id === tech.serviceAreaId);
                            return area
                              ? <span className="text-indigo-400">📍 {area.name} ({area.city})</span>
                              : <span className="text-slate-600">📍 Περιοχή άγνωστη</span>;
                          })()
                        : <span className="text-amber-500/80">⚠️ Χωρίς περιοχή κάλυψης</span>
                      }
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-purple-300 text-sm font-bold">{tech.totalJobs} jobs</div>
                  {editing !== tech.id && (
                    <button onClick={() => startEdit(tech)}
                      className="text-xs text-slate-400 hover:text-white bg-white/5 px-3 py-1.5 rounded-lg transition">
                      ✏️ Επεξ.
                    </button>
                  )}
                </div>
              </div>
              {editing === tech.id && (
                <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Όνομα</label>
                      <input value={editData.name} onChange={(e) => setEditData((p) => ({ ...p, name: e.target.value }))}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Τηλέφωνο</label>
                      <input value={editData.phone} onChange={(e) => setEditData((p) => ({ ...p, phone: e.target.value }))}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Email</label>
                    <input type="email" value={editData.email} onChange={(e) => setEditData((p) => ({ ...p, email: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">📍 Περιοχή Κάλυψης</label>
                    {serviceAreas.length === 0 ? (
                      <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        Δεν υπάρχουν περιοχές. Προσθέστε πρώτα service areas από τον admin.
                      </p>
                    ) : (
                      <select
                        value={editData.serviceAreaId}
                        onChange={(e) => setEditData((p) => ({ ...p, serviceAreaId: e.target.value }))}
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition"
                      >
                        <option value="">-- Χωρίς ανάθεση --</option>
                        {serviceAreas.map((area) => (
                          <option key={area.id} value={area.id}>
                            {area.name} — {area.city} ({area.radiusKm}km)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {newPassword?.techId === tech.id && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                      <p className="text-xs text-amber-400 mb-1">🔑 Νέος κωδικός — αποθηκεύστε τον!</p>
                      <p className="font-mono text-amber-300 text-lg tracking-widest select-all">{newPassword.password}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(tech)} disabled={saving}
                      className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                      {saving ? "Αποθήκευση..." : "Αποθήκευση"}
                    </button>
                    <button onClick={() => resetPassword(tech)} disabled={saving}
                      className="px-4 py-2.5 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-sm rounded-xl transition">
                      🔑 Reset
                    </button>
                    <button onClick={() => { setEditing(null); setNewPassword(null); }}
                      className="px-4 py-2.5 border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 text-sm rounded-xl transition">
                      Άκυρο
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

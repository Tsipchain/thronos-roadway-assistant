"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PLAN_KEYS, PLAN_LIMITS, getPlan } from "@/lib/plans";

const ALL_SERVICES = [
  { type: "BATTERY_REPLACEMENT", label: "🔋 Αντικατάσταση Μπαταρίας", defaultPrice: 49 },
  { type: "BATTERY_CHARGE",      label: "⚡ Φόρτιση Μπαταρίας",        defaultPrice: 19 },
  { type: "TIRE_CHANGE",         label: "🛥 Αλλαγή Λάστιχου",          defaultPrice: 35 },
  { type: "TIRE_REPAIR",         label: "🔧 Επισκευή Λάστιχου",        defaultPrice: 25 },
  { type: "DIAGNOSIS",           label: "🔍 Διάγνωση",                 defaultPrice: 15 },
];
const STATUSES = ["ACTIVE", "SUSPENDED", "PENDING"];

interface TenantData {
  id: string; name: string; slug: string; phone: string | null;
  plan: string; status: string; logoUrl: string | null;
  pricingRules: { serviceType: string; basePrice: number }[];
}

export default function TenantEditPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState("");
  const [status, setStatus] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [savingSvc, setSavingSvc] = useState(false);
  const [svcMsg, setSvcMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/tenants/${slug}`).then((r) => r.json()).then((data: TenantData) => {
      setTenant(data); setName(data.name); setPhone(data.phone ?? "");
      setPlan(data.plan); setStatus(data.status); setLogoUrl(data.logoUrl ?? "");
      const c: Record<string, boolean> = {};
      const p: Record<string, number> = {};
      ALL_SERVICES.forEach((s) => {
        const ex = data.pricingRules.find((r) => r.serviceType === s.type);
        c[s.type] = !!ex; p[s.type] = ex?.basePrice ?? s.defaultPrice;
      });
      setChecked(c); setPrices(p);
    }).finally(() => setLoading(false));
  }, [slug]);

  const saveInfo = async () => {
    setSavingInfo(true); setInfoMsg(null);
    const res = await fetch(`/api/admin/tenants/${slug}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, plan, status, logoUrl }),
    });
    setSavingInfo(false);
    setInfoMsg(res.ok ? "✅ Στοιχεία αποθηκεύτηκαν!" : "❌ Σφάλμα");
    if (res.ok) setTenant((t) => t ? { ...t, plan } : t);
  };

  const saveServices = async () => {
    setSavingSvc(true); setSvcMsg(null);
    const services = ALL_SERVICES.filter((s) => checked[s.type]).map((s) => ({ type: s.type, price: prices[s.type] ?? s.defaultPrice }));
    const res = await fetch(`/api/admin/tenants/${slug}/services`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services }),
    });
    setSavingSvc(false);
    setSvcMsg(res.ok ? "✅ Υπηρεσίες ενημερώθηκαν!" : "❌ Σφάλμα");
  };

  if (loading) return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <p className="text-slate-400">Φόρτωση...</p>
    </main>
  );

  const currentPlanInfo = getPlan(plan);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-8 text-sm">
          <Link href="/admin" className="text-slate-400 hover:text-white transition">← Admin</Link>
          <span className="text-slate-600">/</span>
          <span className="font-mono text-purple-400">{slug}</span>
        </div>

        {/* Basic Info */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold mb-5">🏢 Βασικά Στοιχεία</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Επωνυμία</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Τηλέφωνο</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2101234567"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Logo URL</label>
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..."
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {infoMsg && <div className={`text-sm rounded-xl px-4 py-3 mt-4 ${
            infoMsg.startsWith("✅") ? "bg-green-500/10 border border-green-500/20 text-green-300" : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}>{infoMsg}</div>}
          <button onClick={saveInfo} disabled={savingInfo || !name.trim()}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition">
            {savingInfo ? "Αποθήκευση..." : "Αποθήκευση Στοιχείων"}
          </button>
        </section>

        {/* Subscription / Plan */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-base font-semibold mb-1">💳 Συνδρομή</h2>
          <p className="text-slate-500 text-xs mb-5">Αλλαγή πλανού ενημερώνει άμεσα τα όρια και τα features του tenant.</p>
          <div className="grid gap-3">
            {PLAN_KEYS.map((key) => {
              const p = PLAN_LIMITS[key];
              const isActive = plan === key;
              return (
                <div key={key} onClick={() => setPlan(key)} className={`rounded-2xl border p-4 cursor-pointer transition ${
                  isActive ? `${p.borderColor} ${p.bgColor}` : "border-white/10 hover:border-white/20"
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold ${p.color}`}>{p.label}</span>
                        {isActive && <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full">Τρέχον</span>}
                      </div>
                      <p className="text-xs text-slate-400 mb-2">{p.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                        <span>{p.maxTechnicians === -1 ? "∞" : p.maxTechnicians} τεχνικοί</span>
                        <span>{p.maxServiceAreas === -1 ? "∞" : p.maxServiceAreas} περιοχές</span>
                        {p.hasStats && <span className="text-green-400">✓ Stats</span>}
                        {p.hasEnterprise && <span className="text-amber-400">✓ THR Wallets</span>}
                        {p.hasApiAccess && <span className="text-cyan-400">✓ API</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xl font-bold ${p.color}`}>{p.priceMonthly}€</div>
                      <div className="text-xs text-slate-500">/μήνα</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={saveInfo} disabled={savingInfo || plan === tenant?.plan}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition">
            {savingInfo ? "Αποθήκευση..." : plan === tenant?.plan ? `Τρέχον πλανό: ${currentPlanInfo.label}` : `Αλλαγή σε ${getPlan(plan).label}`}
          </button>
        </section>

        {/* Services */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-2">⚙️ Δραστηριότητες / Υπηρεσίες</h2>
          <p className="text-slate-400 text-xs mb-5">Επιλέξτε ποιες υπηρεσίες προσφέρει αυτή η εταιρεία και τιμές εκκίνησης.</p>
          <div className="space-y-3">
            {ALL_SERVICES.map((s) => (
              <div key={s.type} className={`rounded-xl border p-4 transition ${
                checked[s.type] ? "border-purple-500/50 bg-purple-500/10" : "border-white/10"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input type="checkbox" checked={!!checked[s.type]}
                      onChange={(e) => setChecked((p) => ({ ...p, [s.type]: e.target.checked }))}
                      className="w-5 h-5 rounded accent-purple-500" />
                    <span className={checked[s.type] ? "text-white" : "text-slate-400"}>{s.label}</span>
                  </label>
                  {checked[s.type] && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input type="number" value={prices[s.type] ?? s.defaultPrice}
                        onChange={(e) => setPrices((p) => ({ ...p, [s.type]: Number(e.target.value) }))}
                        className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-purple-500" min={1} />
                      <span className="text-slate-400 text-sm">€</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {svcMsg && <div className={`text-sm rounded-xl px-4 py-3 mt-4 ${
            svcMsg.startsWith("✅") ? "bg-green-500/10 border border-green-500/20 text-green-300" : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}>{svcMsg}</div>}
          <button onClick={saveServices} disabled={savingSvc || Object.values(checked).every((v) => !v)}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition">
            {savingSvc ? "Αποθήκευση..." : "Αποθήκευση Υπηρεσιών"}
          </button>
        </section>
      </div>
    </main>
  );
}

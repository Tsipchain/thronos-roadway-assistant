"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const ALL_SERVICES = [
  { type: "BATTERY_REPLACEMENT", label: "🔋 Αντικατάσταση Μπαταρίας", defaultPrice: 49 },
  { type: "BATTERY_CHARGE",      label: "⚡ Φόρτιση Μπαταρίας",        defaultPrice: 19 },
  { type: "TIRE_CHANGE",         label: "🛥 Αλλαγή Λάστιχου",          defaultPrice: 35 },
  { type: "TIRE_REPAIR",         label: "🔧 Επισκευή Λάστιχου",        defaultPrice: 25 },
  { type: "DIAGNOSIS",           label: "🔍 Διάγνωση",                 defaultPrice: 15 },
];

const PLANS = ["STARTER", "PRO", "ENTERPRISE"];
const STATUSES = ["ACTIVE", "SUSPENDED", "PENDING"];

interface Rule { serviceType: string; basePrice: number }
interface TenantData {
  id: string; name: string; slug: string; phone: string | null;
  plan: string; status: string; logoUrl: string | null;
  pricingRules: Rule[];
}

export default function TenantEditPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [tenant,  setTenant]  = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);

  // Info form state
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [plan,    setPlan]    = useState("");
  const [status,  setStatus]  = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [savingInfo,  setSavingInfo]  = useState(false);
  const [infoMsg,     setInfoMsg]     = useState<string | null>(null);

  // Services state
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [prices,  setPrices]  = useState<Record<string, number>>({});
  const [savingSvc,  setSavingSvc]  = useState(false);
  const [svcMsg,     setSvcMsg]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/tenants/${slug}`)
      .then((r) => r.json())
      .then((data: TenantData) => {
        setTenant(data);
        setName(data.name);
        setPhone(data.phone ?? "");
        setPlan(data.plan);
        setStatus(data.status);
        setLogoUrl(data.logoUrl ?? "");

        const c: Record<string, boolean> = {};
        const p: Record<string, number>  = {};
        ALL_SERVICES.forEach((s) => {
          const existing = data.pricingRules.find((r) => r.serviceType === s.type);
          c[s.type] = !!existing;
          p[s.type] = existing?.basePrice ?? s.defaultPrice;
        });
        setChecked(c);
        setPrices(p);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const saveInfo = async () => {
    setSavingInfo(true);
    setInfoMsg(null);
    const res = await fetch(`/api/admin/tenants/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, plan, status, logoUrl }),
    });
    setSavingInfo(false);
    setInfoMsg(res.ok ? "✅ Στοιχεία αποθηκεύτηκαν!" : "❌ Σφάλμα αποθήκευσης");
  };

  const saveServices = async () => {
    setSavingSvc(true);
    setSvcMsg(null);
    const services = ALL_SERVICES
      .filter((s) => checked[s.type])
      .map((s) => ({ type: s.type, price: prices[s.type] ?? s.defaultPrice }));
    const res = await fetch(`/api/admin/tenants/${slug}/services`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ services }),
    });
    setSavingSvc(false);
    setSvcMsg(res.ok ? "✅ Υπηρεσίες ενημερώθηκαν!" : "❌ Σφάλμα αποθήκευσης");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <p className="text-slate-400">Φόρτωση...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Breadcrumb */}
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
              <label className="text-xs text-slate-400 block mb-1.5">Επωνυμία Εταιρείας</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Τηλέφωνο</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="π.χ. 2101234567"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Logo URL (προαιρετικό)</label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                >
                  {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {infoMsg && (
            <div className={`text-sm rounded-xl px-4 py-3 mt-4 ${
              infoMsg.startsWith("✅")
                ? "bg-green-500/10 border border-green-500/20 text-green-300"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}>{infoMsg}</div>
          )}

          <button
            onClick={saveInfo}
            disabled={savingInfo || !name.trim()}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
          >
            {savingInfo ? "Αποθήκευση..." : "Αποθήκευση Στοιχείων"}
          </button>
        </section>

        {/* Services */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-base font-semibold mb-2">⚙️ Δραστηριότητες / Υπηρεσίες</h2>
          <p className="text-slate-400 text-xs mb-5">Επιλέξτε ποιες υπηρεσίες προσφέρει αυτή η εταιρεία και τιμές εκκίνησης.</p>

          <div className="space-y-3">
            {ALL_SERVICES.map((s) => (
              <div key={s.type} className={`rounded-xl border p-4 transition ${
                checked[s.type]
                  ? "border-purple-500/50 bg-purple-500/10"
                  : "border-white/10"
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={!!checked[s.type]}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [s.type]: e.target.checked }))
                      }
                      className="w-5 h-5 rounded accent-purple-500"
                    />
                    <span className={checked[s.type] ? "text-white" : "text-slate-400"}>
                      {s.label}
                    </span>
                  </label>
                  {checked[s.type] && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        value={prices[s.type] ?? s.defaultPrice}
                        onChange={(e) =>
                          setPrices((prev) => ({ ...prev, [s.type]: Number(e.target.value) }))
                        }
                        className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-purple-500"
                        min={1}
                      />
                      <span className="text-slate-400 text-sm">€</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {svcMsg && (
            <div className={`text-sm rounded-xl px-4 py-3 mt-4 ${
              svcMsg.startsWith("✅")
                ? "bg-green-500/10 border border-green-500/20 text-green-300"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}>{svcMsg}</div>
          )}

          <button
            onClick={saveServices}
            disabled={savingSvc || Object.values(checked).every((v) => !v)}
            className="mt-4 w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
          >
            {savingSvc ? "Αποθήκευση..." : "Αποθήκευση Υπηρεσιών"}
          </button>
        </section>

      </div>
    </main>
  );
}

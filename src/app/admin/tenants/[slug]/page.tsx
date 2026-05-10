"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const ALL_SERVICES = [
  { type: "BATTERY_REPLACEMENT", label: "🔋 Αντικατάσταση Μπαταρίας", defaultPrice: 49 },
  { type: "BATTERY_CHARGE",      label: "⚡ Φόρτιση Μπαταρίας",        defaultPrice: 19 },
  { type: "TIRE_CHANGE",         label: "🛞 Αλλαγή Λάστιχου",          defaultPrice: 35 },
  { type: "TIRE_REPAIR",         label: "🔧 Επισκευή Λάστιχου",        defaultPrice: 25 },
  { type: "DIAGNOSIS",           label: "🔍 Διάγνωση",                 defaultPrice: 15 },
];

interface Rule { id: string; serviceType: string; basePrice: number }

export default function TenantServicesPage() {
  const params   = useParams();
  const router   = useRouter();
  const slug     = params.slug as string;

  const [rules,   setRules]   = useState<Rule[]>([]);
  const [prices,  setPrices]  = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/tenants/${slug}/services`)
      .then((r) => r.json())
      .then((data: Rule[]) => {
        setRules(data);
        const c: Record<string, boolean> = {};
        const p: Record<string, number>  = {};
        ALL_SERVICES.forEach((s) => {
          const existing = data.find((r) => r.serviceType === s.type);
          c[s.type] = !!existing;
          p[s.type] = existing?.basePrice ?? s.defaultPrice;
        });
        setChecked(c);
        setPrices(p);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const services = ALL_SERVICES
      .filter((s) => checked[s.type])
      .map((s) => ({ type: s.type, price: prices[s.type] ?? s.defaultPrice }));

    const res = await fetch(`/api/admin/tenants/${slug}/services`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ services }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("✅ Υπηρεσίες ενημερώθηκαν!");
    } else {
      setMsg("❌ Σφάλμα — ελέγξτε αν είστε logged in ως Super Admin");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-white transition text-sm">← Admin</Link>
          <span className="text-slate-600">/</span>
          <h1 className="text-xl font-bold">Υπηρεσίες: <span className="font-mono text-purple-400">{slug}</span></h1>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-12">Φόρτωση...</div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <p className="text-slate-400 text-sm">Επιλέξτε ποιες υπηρεσίες προσφέρει αυτή η εταιρεία. Αυτό καθορίζει τι εμφανίζεται στη σελίδα SOS.</p>

            <div className="space-y-3">
              {ALL_SERVICES.map((s) => (
                <div key={s.type} className={`rounded-xl border p-4 transition ${
                  checked[s.type]
                    ? "border-purple-500/50 bg-purple-500/10"
                    : "border-white/10 bg-white/3"
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

            {msg && (
              <div className={`text-sm rounded-xl px-4 py-3 ${
                msg.startsWith("✅")
                  ? "bg-green-500/10 border border-green-500/20 text-green-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}>
                {msg}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving || Object.values(checked).every((v) => !v)}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
              >
                {saving ? "Αποθήκευση..." : "Αποθήκευση Υπηρεσιών"}
              </button>
              <Link
                href="/admin"
                className="px-5 py-3 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-sm transition text-center"
              >
                Άκυρο
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

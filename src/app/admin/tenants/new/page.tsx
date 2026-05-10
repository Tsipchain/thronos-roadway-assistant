"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ALL_SERVICES = [
  { type: "BATTERY_REPLACEMENT", label: "🔋 Αντικατάσταση Μπαταρίας",  price: 49 },
  { type: "BATTERY_CHARGE",      label: "⚡ Φόρτιση Μπαταρίας",          price: 19 },
  { type: "TIRE_CHANGE",         label: "🛞 Αλλαγή Λάστιχου",            price: 35 },
  { type: "TIRE_REPAIR",         label: "🔧 Επισκευή Λάστιχου",          price: 25 },
  { type: "DIAGNOSIS",           label: "🔍 Διάγνωση / Έλεγχος",         price: 15 },
];

export default function NewTenantPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "", slug: "", email: "", phone: "",
    vatNumber: "", billingAddress: "", plan: "starter",
  });

  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>({
    BATTERY_REPLACEMENT: true,
    BATTERY_CHARGE: true,
    TIRE_CHANGE: false,
    TIRE_REPAIR: false,
    DIAGNOSIS: true,
  });
  const [servicePrices, setServicePrices] = useState<Record<string, number>>(
    Object.fromEntries(ALL_SERVICES.map((s) => [s.type, s.price]))
  );

  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);

  const field = (key: keyof typeof form, label: string, type = "text", placeholder = "") => (
    <div>
      <label className="text-xs text-slate-400 block mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => {
          const v = e.target.value;
          setForm((f) => ({
            ...f,
            [key]: v,
            ...(key === "name" ? { slug: autoSlug(v) } : {}),
          }));
        }}
        placeholder={placeholder}
        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
      />
    </div>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Object.values(selectedServices).some(Boolean)) {
      setError("Επιλέξτε τουλάχιστον μία υπηρεσία.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const services = ALL_SERVICES
        .filter((s) => selectedServices[s.type])
        .map((s) => ({ type: s.type, price: servicePrices[s.type] ?? s.price }));

      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, services }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Σφάλμα");
      router.push("/admin");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const hasServices = Object.values(selectedServices).some(Boolean);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-white transition text-sm">← Admin</Link>
          <h1 className="text-xl font-bold">Νέος Partner</h1>
        </div>

        <form onSubmit={submit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300">Στοιχεία Εταιρείας</h2>
            {field("name", "Επωνυμία *", "text", "LK Μπαταρίες")}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Slug (URL) *</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">/t/</span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))
                  }
                  placeholder="lkbateries"
                  className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition font-mono"
                  required
                />
              </div>
            </div>
            {field("email", "Email", "email", "info@example.gr")}
            {field("phone", "Τηλέφωνο", "tel", "+302310000000")}
            {field("vatNumber", "ΑΦΜ")}
            {field("billingAddress", "Διεύθυνση")}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
              >
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          {/* Service Selection */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-slate-300 mb-1">Δραστηριότητα — Υπηρεσίες</h2>
            <p className="text-xs text-slate-500 mb-4">
              Επιλέξτε τι προσφέρει αυτή η εταιρεία. Εμφανίζεται στη σελίδα SOS των πελατών.
            </p>
            <div className="space-y-2">
              {ALL_SERVICES.map((s) => (
                <div
                  key={s.type}
                  className={`flex items-center justify-between gap-4 rounded-xl border p-3.5 transition ${
                    selectedServices[s.type]
                      ? "border-purple-500/50 bg-purple-500/10"
                      : "border-white/10 bg-white/3"
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={!!selectedServices[s.type]}
                      onChange={(e) =>
                        setSelectedServices((prev) => ({ ...prev, [s.type]: e.target.checked }))
                      }
                      className="w-5 h-5 rounded accent-purple-500 shrink-0"
                    />
                    <span className={`text-sm truncate ${
                      selectedServices[s.type] ? "text-white" : "text-slate-500"
                    }`}>
                      {s.label}
                    </span>
                  </label>
                  {selectedServices[s.type] && (
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        value={servicePrices[s.type] ?? s.price}
                        onChange={(e) =>
                          setServicePrices((prev) => ({ ...prev, [s.type]: Number(e.target.value) }))
                        }
                        className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:border-purple-500"
                        min={1}
                      />
                      <span className="text-slate-400 text-xs">€</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!hasServices && (
              <p className="text-amber-400 text-xs mt-3">⚠ Επιλέξτε τουλάχιστον μία υπηρεσία</p>
            )}
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.name || !form.slug || !hasServices}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Δημιουργία..." : "Δημιουργία Partner →"}
          </button>
        </form>
      </div>
    </main>
  );
}

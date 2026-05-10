"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type PricingRule = { serviceType: string; basePrice: number };
type Tenant = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  logoUrl: string | null;
  pricingRules: PricingRule[];
};

const SERVICE_LABELS: Record<string, string> = {
  BATTERY_REPLACEMENT: "Αντικατάσταση Μπαταρίας",
  BATTERY_CHARGE:      "Φόρτιση Μπαταρίας",
  TIRE_CHANGE:         "Αλλαγή Λάστιχου",
  TIRE_REPAIR:         "Επισκευή Λάστιχου",
  DIAGNOSIS:           "Διάγνωση / Έλεγχος",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 35 }, (_, i) => CURRENT_YEAR - i);

type Step = "idle" | "locating" | "form" | "submitting";

export default function CustomerSOS({ tenant }: { tenant: Tenant }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [service, setService] = useState(
    tenant.pricingRules[0]?.serviceType ?? "BATTERY_REPLACEMENT"
  );
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [symptoms, setSymptoms] = useState("");
  const [error, setError] = useState<string | null>(null);

  const locate = () => {
    if (!navigator.geolocation) {
      setError("Ο browser σας δεν υποστηρίζει GPS.");
      return;
    }
    setStep("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStep("form");
      },
      () => {
        setError("Δεν επιτράπηκε η πρόσβαση στη τοποθεσία. Ενεργοποιήστε το GPS.");
        setStep("idle");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const submit = async () => {
    if (!location || !phone.trim() || !plate.trim() || !make.trim() || !model.trim()) return;
    setStep("submitting");
    setError(null);
    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          serviceType: service,
          latitude: location.lat,
          longitude: location.lng,
          phone: phone.trim(),
          plate: plate.trim(),
          make: make.trim(),
          model: model.trim(),
          year: parseInt(year, 10),
          symptoms: symptoms.trim() ? [symptoms.trim()] : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Σφάλμα");
      // Redirect to live tracking page
      router.push(`/t/${tenant.slug}/track/${data.id}`);
    } catch (e: any) {
      setError(e.message);
      setStep("form");
    }
  };

  const selectedPrice = tenant.pricingRules.find((p) => p.serviceType === service)?.basePrice;
  const canSubmit = !!(phone.trim() && plate.trim() && make.trim() && model.trim());

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Brand Header */}
        <div className="text-center mb-8">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt={tenant.name} className="h-16 mx-auto mb-3 object-contain" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-amber-600 flex items-center justify-center text-3xl font-bold mx-auto mb-3 shadow-lg shadow-amber-900/30">
              {tenant.name[0]}
            </div>
          )}
          <h1 className="text-2xl font-bold">{tenant.name}</h1>
          <p className="text-slate-400 text-sm mt-1">24/7 Οδική Βοήθεια</p>
          {tenant.phone && (
            <a
              href={`tel:${tenant.phone}`}
              className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm mt-2 transition"
            >
              📞 {tenant.phone}
            </a>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* IDLE — show prices + SOS button */}
        {step === "idle" && (
          <>
            {tenant.pricingRules.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-5">
                <div className="text-xs text-slate-400 uppercase tracking-widest mb-3">Υπηρεσίες</div>
                <div className="space-y-2">
                  {tenant.pricingRules.map((p) => (
                    <div key={p.serviceType} className="flex justify-between text-sm">
                      <span className="text-slate-300">{SERVICE_LABELS[p.serviceType] ?? p.serviceType}</span>
                      <span className="text-purple-300 font-medium">από {p.basePrice}€</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={locate}
              className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-2xl font-bold py-7 rounded-2xl transition shadow-xl shadow-red-900/40"
            >
              🆘 SOS
              <div className="text-base font-normal mt-1">Χρειάζομαι Βοήθεια</div>
            </button>
          </>
        )}

        {/* LOCATING */}
        {step === "locating" && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4 animate-pulse">📍</div>
            <p className="text-slate-300">Εντοπισμός τοποθεσίας...</p>
            <p className="text-slate-500 text-sm mt-2">Παρακαλώ επιτρέψτε πρόσβαση στο GPS</p>
          </div>
        )}

        {/* FORM */}
        {step === "form" && location && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span className="text-lg">✅</span>
              <span>Τοποθεσία εντοπίστηκε</span>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Τύπος Βοήθειας</label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
              >
                {tenant.pricingRules.map((p) => (
                  <option key={p.serviceType} value={p.serviceType}>
                    {SERVICE_LABELS[p.serviceType] ?? p.serviceType} — {p.basePrice}€+
                  </option>
                ))}
              </select>
              {selectedPrice && (
                <p className="text-xs text-slate-500 mt-1">Εκτ. κόστος: από {selectedPrice}€</p>
              )}
            </div>

            {/* Vehicle Info */}
            <div className="border-t border-white/5 pt-4">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-3">Στοιχεία Οχήματος</div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Μάρκα *</label>
                  <input
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="π.χ. Toyota"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Μοντέλο *</label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="π.χ. Yaris"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Έτος</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Πινακίδα *</label>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="ΑΑΑ-0000"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition uppercase tracking-widest"
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="border-t border-white/5 pt-4">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-3">Επικοινωνία</div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Τηλέφωνό σας *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="69XXXXXXXX"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition"
                  inputMode="tel"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Περιγραφή (προαιρετικό)</label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="π.χ. Δεν παίρνει μπρος..."
                rows={2}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <button
              onClick={submit}
              disabled={!canSubmit}
              className="w-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition"
            >
              Αποστολή Αιτήματος →
            </button>
          </div>
        )}

        {/* SUBMITTING */}
        {step === "submitting" && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4 animate-spin">⚙️</div>
            <p className="text-slate-300">Αναζήτηση διαθέσιμου τεχνικού...</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-slate-700 text-xs">
            Powered by{" "}
            <span className="text-purple-600">Thronos Chain</span>
          </p>
        </div>
      </div>
    </main>
  );
}

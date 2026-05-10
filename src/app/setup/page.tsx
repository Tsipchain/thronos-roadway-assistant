"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface SetupStatus {
  initialized: boolean;
  users: number;
  tenants: number;
  superAdminCreatedAt: string | null;
}

interface Credential {
  email: string;
  password: string;
  url: string;
}

interface SetupResult {
  ok: boolean;
  message: string;
  error?: string;
  credentials?: {
    superAdmin: Credential;
    tenantAdmin: Credential;
    technician: Credential;
    customerSOS: { url: string };
  };
}

export default function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setError("Αδυναμία σύνδεσης με τη βάση δεδομένων"))
      .finally(() => setLoading(false));
  }, []);

  const runSetup = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data: SetupResult = await res.json();
      if (data.ok) {
        setResult(data);
        setStatus((prev) => prev ? { ...prev, initialized: true } : null);
      } else {
        setError(data.message || data.error || "Σφάλμα κατά την αρχικοποίηση");
      }
    } catch {
      setError("Network error — ελέγξτε τη σύνδεση με τη βάση δεδομένων");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg shadow-purple-900/50">
            ⚡
          </div>
          <h1 className="text-2xl font-bold">Thronos Roadway Setup</h1>
          <p className="text-slate-400 text-sm mt-1">Αρχικοποίηση βάσης δεδομένων</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          {loading ? (
            <div className="text-center text-slate-400 py-8">Έλεγχος κατάστασης...</div>
          ) : error && !result ? (
            <div className="space-y-4">
              <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm">{error}</div>
              <button
                onClick={runSetup}
                disabled={running}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
              >
                {running ? "Αρχικοποίηση..." : "🚀 Δοκιμάστε Ξανά"}
              </button>
            </div>
          ) : status?.initialized && !result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="text-2xl">✅</div>
                <div>
                  <div className="font-semibold text-green-300">Η βάση έχει ήδη αρχικοποιηθεί</div>
                  <div className="text-sm text-slate-400">{status.users} χρήστες · {status.tenants} tenants</div>
                </div>
              </div>
              <Link
                href="/login"
                className="block w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition text-center"
              >
                Πήγαινε στο Login →
              </Link>
            </div>
          ) : result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                <div className="text-2xl">🎉</div>
                <div>
                  <div className="font-semibold text-green-300">{result.message}</div>
                </div>
              </div>
              {result.credentials && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credentials</h3>
                  {([
                    { label: "Super Admin",           ...result.credentials.superAdmin },
                    { label: "Tenant Admin (LK Shop)", ...result.credentials.tenantAdmin },
                    { label: "Τεχνικός",               ...result.credentials.technician },
                  ] as Array<Credential & { label: string }>).map((c) => (
                    <div key={c.label} className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
                      <div className="text-xs text-slate-500 mb-1">{c.label}</div>
                      <div className="font-mono text-sm text-white">{c.email}</div>
                      <div className="font-mono text-sm text-purple-300">{c.password}</div>
                      <Link href={c.url} className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">
                        {c.url} →
                      </Link>
                    </div>
                  ))}
                  <div className="bg-slate-800/60 border border-white/10 rounded-xl p-4">
                    <div className="text-xs text-slate-500 mb-1">Customer SOS (χωρίς login)</div>
                    <Link
                      href={result.credentials.customerSOS.url}
                      className="font-mono text-sm text-blue-400 hover:text-blue-300"
                    >
                      {result.credentials.customerSOS.url} →
                    </Link>
                  </div>
                </div>
              )}
              <Link
                href="/login"
                className="block w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition text-center"
              >
                Πήγαινε στο Login →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="text-amber-300 font-semibold mb-2">Η βάση είναι κενή</div>
                <div className="text-slate-400 text-sm mb-2">Αυτό θα δημιουργήσει:</div>
                <ul className="text-sm text-slate-300 space-y-1">
                  <li>• Super Admin (admin@thronoschain.com)</li>
                  <li>• LK Shop tenant + Admin (admin@lkshop.gr)</li>
                  <li>• 5 Τεχνικοί (tech1-5@lkshop.gr)</li>
                  <li>• Τιμοκατάλογος &amp; Περιοχές Εξυπηρέτησης</li>
                </ul>
              </div>
              {error && (
                <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm">{error}</div>
              )}
              <button
                onClick={runSetup}
                disabled={running}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
              >
                {running ? "Αρχικοποίηση..." : "🚀 Αρχικοποίηση Βάσης"}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Powered by <span className="text-purple-500">Thronos Chain</span>
        </p>
      </div>
    </main>
  );
}

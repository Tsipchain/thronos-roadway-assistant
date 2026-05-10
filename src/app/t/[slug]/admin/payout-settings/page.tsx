"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Settings = {
  payoutMethod: string;
  payoutIban: string | null;
  payoutBic: string | null;
  payoutWalletAddress: string | null;
  platformFeePercent: number;
};

type Payout = {
  id: string;
  grossAmountEur: number;
  feePercent: number;
  feeAmountEur: number;
  netAmountEur: number;
  status: string;
  method: string;
  paidAt: string | null;
  bankRef: string | null;
  cryptoTxHash: string | null;
  createdAt: string;
};

const METHOD_LABELS: Record<string, { label: string; desc: string }> = {
  BANK_TRANSFER:      { label: "🏦 Τραπεζικό Έμβασμα (SEPA)", desc: "Μεταφορά σε IBAN μέσα σε 1-3 εργάσιμες" },
  USDC_ETH:          { label: "💵 USDC (Ethereum)", desc: "Stablecoin σε Ethereum network (~2-8€ fees)" },
  USDT_ETH:          { label: "💵 USDT (Ethereum)", desc: "Stablecoin σε Ethereum network (~2-8€ fees)" },
  USDC_POLYGON:      { label: "💵 USDC (Polygon)", desc: "Stablecoin σε Polygon network (~0.01-0.10€ fees)" },
  USDT_POLYGON:      { label: "💵 USDT (Polygon)", desc: "Stablecoin σε Polygon network (~0.01-0.10€ fees)" },
};

export default function PayoutSettingsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [settings, setSettings] = useState<Settings>({
    payoutMethod: "BANK_TRANSFER",
    payoutIban: null,
    payoutBic: null,
    payoutWalletAddress: null,
    platformFeePercent: 8,
  });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/t/${slug}/payout-settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setPayouts(data.payouts);
      }
    };
    load();
  }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/t/${slug}/payout-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payoutMethod: settings.payoutMethod,
        payoutIban: settings.payoutIban,
        payoutBic: settings.payoutBic,
        payoutWalletAddress: settings.payoutWalletAddress,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg("✅ Ρυθμίσεις αποθηκεύτηκαν");
    } else {
      setMsg("❌ Σφάλμα αποθήκευσης");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href={`/t/${slug}/admin`} className="text-slate-400 hover:text-white transition">← Admin</Link>
          <div className="text-slate-600">/</div>
          <h1 className="text-2xl font-bold">💰 Ρυθμίσεις Αποσύρσεως</h1>
        </div>

        {msg && (
          <div className={`mb-6 p-4 rounded-lg text-sm ${
            msg.startsWith("✅") ? "bg-green-500/10 border border-green-500/30 text-green-300" : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}>
            {msg}
          </div>
        )}

        {/* Settings Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-6">Μέθοδος Πληρωμής</h2>

          <div className="space-y-4 mb-6">
            {Object.entries(METHOD_LABELS).map(([key, { label, desc }]) => (
              <label key={key} className="flex items-start gap-4 p-4 border border-white/10 rounded-xl hover:bg-white/5 cursor-pointer transition">
                <input
                  type="radio"
                  name="method"
                  value={key}
                  checked={settings.payoutMethod === key}
                  onChange={(e) => setSettings((p) => ({ ...p, payoutMethod: e.target.value }))}
                  className="mt-1 w-4 h-4"
                />
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-slate-400 mt-1">{desc}</div>
                </div>
              </label>
            ))}
          </div>

          {/* IBAN for Bank Transfer */}
          {settings.payoutMethod === "BANK_TRANSFER" && (
            <div className="space-y-3 mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div>
                <label className="text-sm text-slate-300 block mb-1">IBAN *</label>
                <input
                  type="text"
                  value={settings.payoutIban || ""}
                  onChange={(e) => setSettings((p) => ({ ...p, payoutIban: e.target.value }))}
                  placeholder="GR9101101050000010547023795"
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-300 block mb-1">BIC (προαιρετικό)</label>
                <input
                  type="text"
                  value={settings.payoutBic || ""}
                  onChange={(e) => setSettings((p) => ({ ...p, payoutBic: e.target.value }))}
                  placeholder="EELAGRAA"
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Wallet for Crypto */}
          {(settings.payoutMethod.includes("USDC") || settings.payoutMethod.includes("USDT")) && (
            <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-3">
              <div>
                <label className="text-sm text-slate-300 block mb-1">ETH/Polygon Wallet Address *</label>
                <input
                  type="text"
                  value={settings.payoutWalletAddress || ""}
                  onChange={(e) => setSettings((p) => ({ ...p, payoutWalletAddress: e.target.value }))}
                  placeholder="0x..."
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <p>💡 <strong>Crypto-to-Fiat:</strong> Μετατροπή σε EUR χωρίς KYC</p>
                <p>Χρησιμοποιήστε το <a href="https://www.ether.fi/@74df90a0" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">EtherFi referral link →</a> για να λάβετε τα κέρδη σας σε EUR</p>
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            {saving ? "Αποθήκευση..." : "💾 Αποθήκευση"}
          </button>
        </div>

        {/* Pending Payouts */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-6">Εκκρεμείς Αποσυρσεις</h2>
          {payouts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <div className="text-4xl mb-3">✅</div>
              <p>Δεν υπάρχουν εκκρεμείς αποσυρσεις.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-white/10">
                    <th className="pb-3 text-left">Ποσό (Gross)</th>
                    <th className="pb-3 text-left">Τέλος Platform</th>
                    <th className="pb-3 text-left">Καθαρό</th>
                    <th className="pb-3 text-left">Status</th>
                    <th className="pb-3 text-left">Ημνία</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3">{p.grossAmountEur.toFixed(2)}€</td>
                      <td className="py-3 text-slate-400">{p.feePercent}% ({p.feeAmountEur.toFixed(2)}€)</td>
                      <td className="py-3 font-semibold text-green-300">{p.netAmountEur.toFixed(2)}€</td>
                      <td className="py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          p.status === "PENDING" ? "bg-amber-500/20 text-amber-300" :
                          p.status === "PAID" ? "bg-green-500/20 text-green-300" :
                          p.status === "OFFSET" ? "bg-slate-500/20 text-slate-400" :
                          "bg-blue-500/20 text-blue-300"
                        }`}>
                          {p.status === "OFFSET" ? "Subscription" : p.status}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 text-xs">
                        {new Date(p.createdAt).toLocaleDateString("el-GR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

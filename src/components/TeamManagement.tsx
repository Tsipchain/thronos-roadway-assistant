"use client";
import { useState } from "react";

const MIN_PLEDGE = 0.011;

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE:   "Υπάλληλος",
  CONTRACTOR: "Συνεργάτης",
  PARTNER:    "Partner",
  MANAGER:    "Διευθυντής",
};

type RewardTx = {
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
  txHash: string | null;
};

type Member = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  thrAddress: string | null;
  thrBalance: number;
  totalEarned: number;
  rewardTxs: RewardTx[];
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  thrWalletAddress: string | null;
  btcPledgeVerified: number;
  pledgeVerifiedAt: string | null;
  enterpriseEnabled: boolean;
  thrRewardPoolBalance: number;
  teamMembers: Member[];
};

export default function TeamManagement({ tenant }: { tenant: Tenant }) {
  const [members, setMembers] = useState<Member[]>(tenant.teamMembers);
  const [enterprise, setEnterprise] = useState(tenant.enterpriseEnabled);
  const [thrWallet, setThrWallet] = useState(tenant.thrWalletAddress ?? "");
  const [pledge, setPledge] = useState(tenant.btcPledgeVerified);
  const [poolBalance, setPoolBalance] = useState(tenant.thrRewardPoolBalance);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  // New member form
  const [showForm, setShowForm] = useState(false);
  const [newMember, setNewMember] = useState({ name: "", phone: "", email: "", role: "EMPLOYEE", thrAddress: "" });
  const [adding, setAdding] = useState(false);

  // Reward form
  const [rewardTarget, setRewardTarget] = useState<string | null>(null);
  const [rewardAmt, setRewardAmt] = useState("");
  const [rewardReason, setRewardReason] = useState("");
  const [sending, setSending] = useState(false);

  const [walletSaving, setWalletSaving] = useState(false);

  const checkPledge = async () => {
    setChecking(true);
    setCheckMsg(null);
    try {
      const res = await fetch(`/api/tenants/${tenant.slug}/pledge`);
      const data = await res.json();
      setPledge(data.btcPledged ?? 0);
      setEnterprise(data.eligible ?? false);
      setCheckMsg(
        data.eligible
          ? `✅ Επαληθεύτηκε! BTC pledged: ${data.btcPledged.toFixed(4)}`
          : `⚠️ ${data.btcPledged.toFixed(4)} BTC — απαιτείται ${MIN_PLEDGE} BTC`
      );
    } catch {
      setCheckMsg("❌ Αποτυχία σύνδεσης με το Thronos Chain");
    } finally {
      setChecking(false);
    }
  };

  const saveWallet = async () => {
    if (!thrWallet.startsWith("THR")) return;
    setWalletSaving(true);
    try {
      await fetch(`/api/tenants/${tenant.slug}/pledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thrWalletAddress: thrWallet }),
      });
    } finally {
      setWalletSaving(false);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.slug}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });
      const data = await res.json();
      if (res.ok) {
        setMembers((m) => [...m, { ...data, rewardTxs: [] }]);
        setNewMember({ name: "", phone: "", email: "", role: "EMPLOYEE", thrAddress: "" });
        setShowForm(false);
      }
    } finally {
      setAdding(false);
    }
  };

  const sendReward = async () => {
    if (!rewardTarget || !rewardAmt) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tenants/${tenant.slug}/team/reward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: rewardTarget,
          amount: parseFloat(rewardAmt),
          reason: rewardReason || "Bonus",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPoolBalance((b) => b - parseFloat(rewardAmt));
        setMembers((ms) =>
          ms.map((m) =>
            m.id === rewardTarget
              ? { ...m, thrBalance: m.thrBalance + parseFloat(rewardAmt), totalEarned: m.totalEarned + parseFloat(rewardAmt) }
              : m
          )
        );
        setRewardTarget(null);
        setRewardAmt("");
        setRewardReason("");
      } else {
        alert(data.error);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <a href={`/t/${tenant.slug}/admin`} className="text-slate-400 hover:text-white transition">← Admin</a>
          <h1 className="text-xl font-bold">Ομάδα & Wallets — {tenant.name}</h1>
        </div>

        {/* Pledge Status */}
        <div className={`rounded-2xl border p-6 mb-6 ${
          enterprise
            ? "border-purple-500/40 bg-purple-500/10"
            : "border-amber-500/40 bg-amber-500/10"
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-lg flex items-center gap-2">
                {enterprise ? "⚡ Enterprise Active" : "🔒 Enterprise Locked"}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                {enterprise
                  ? `BTC Pledge: ${pledge.toFixed(4)} BTC ✓ — Η ομάδα σας μπορεί να δημιουργεί THR wallets & να λαμβάνει rewards.`
                  : `Απαιτείται pledge ≥ ${MIN_PLEDGE} BTC στο Thronos Chain. Τρέχον: ${pledge.toFixed(4)} BTC.`
                }
              </p>
              {checkMsg && <p className="text-sm mt-2 font-medium">{checkMsg}</p>}
            </div>
            <button
              onClick={checkPledge}
              disabled={checking}
              className="shrink-0 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              {checking ? "Έλεγχος..." : "🔍 Επαλήθευση Chain"}
            </button>
          </div>

          {/* THR Wallet input */}
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={thrWallet}
              onChange={(e) => setThrWallet(e.target.value)}
              placeholder="THRxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-sm font-mono focus:outline-none focus:border-purple-500 transition"
            />
            <button
              onClick={saveWallet}
              disabled={!thrWallet.startsWith("THR") || walletSaving}
              className="bg-white/10 hover:bg-white/20 disabled:opacity-40 px-4 py-2 rounded-xl text-sm transition"
            >
              {walletSaving ? "..." : "Αποθήκευση"}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Εισάγετε το THR wallet της εταιρείας σας (αυτό που έχει κάνει pledge BTC στο thronoschain.org)
          </p>
        </div>

        {/* Reward Pool */}
        {enterprise && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-400">THR Reward Pool</div>
              <div className="text-3xl font-bold text-purple-400 mt-1">{poolBalance.toFixed(2)} THR</div>
              <div className="text-xs text-slate-500 mt-1">Διαθέσιμο για rewards στην ομάδα</div>
            </div>
            <div className="text-4xl">🏆</div>
          </div>
        )}

        {/* Team Members */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold">Μέλη Ομάδας ({members.length})</h2>
            {enterprise && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-purple-600 hover:bg-purple-500 text-sm px-4 py-2 rounded-xl transition"
              >
                + Νέο Μέλος
              </button>
            )}
          </div>

          {/* Add member form */}
          {showForm && (
            <form onSubmit={addMember} className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 grid grid-cols-2 gap-3">
              {[
                { k: "name", l: "Όνομα *", p: "Νίκος Παπαδόπουλος" },
                { k: "phone", l: "Τηλέφωνο", p: "69XXXXXXXX" },
                { k: "email", l: "Email", p: "nikos@lkshop.gr" },
                { k: "thrAddress", l: "THR Wallet", p: "THRxxx..." },
              ].map(({ k, l, p }) => (
                <div key={k} className={k === "thrAddress" ? "col-span-2" : ""}>
                  <label className="text-xs text-slate-400 block mb-1">{l}</label>
                  <input
                    type="text"
                    value={(newMember as any)[k]}
                    onChange={(e) => setNewMember((m) => ({ ...m, [k]: e.target.value }))}
                    placeholder={p}
                    required={k === "name"}
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Ρόλος</label>
                <select
                  value={newMember.role}
                  onChange={(e) => setNewMember((m) => ({ ...m, role: e.target.value }))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-sm"
                >
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2 col-span-2">
                <button
                  type="submit"
                  disabled={adding || !newMember.name}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-5 py-2 rounded-xl text-sm font-semibold transition"
                >
                  {adding ? "..." : "Προσθήκη"}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white text-sm transition">
                  Ακύρωση
                </button>
              </div>
            </form>
          )}

          {members.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              <div className="text-4xl mb-2">👥</div>
              <p>{enterprise ? "Προσθέστε το πρώτο μέλος της ομάδας." : "Ολοκληρώστε το pledge για να διαχειριστείτε την ομάδα."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((m) => (
                <div key={m.id} className="border border-white/10 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.name}</span>
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-slate-300">
                          {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      </div>
                      {m.phone && <div className="text-xs text-slate-400 mt-0.5">{m.phone}</div>}
                      {m.thrAddress ? (
                        <div className="text-xs font-mono text-purple-400 mt-1 truncate max-w-xs">
                          ⚡ {m.thrAddress}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 mt-1">Χωρίς THR wallet</div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-purple-300 font-bold">{m.thrBalance.toFixed(2)} THR</div>
                        <div className="text-xs text-slate-500">Σύνολο: {m.totalEarned.toFixed(2)}</div>
                      </div>
                      {enterprise && m.thrAddress && (
                        <button
                          onClick={() => setRewardTarget(m.id)}
                          className="bg-purple-600/40 hover:bg-purple-600 text-purple-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                        >
                          🎁 Reward
                        </button>
                      )}
                    </div>
                  </div>
                  {m.rewardTxs.length > 0 && (
                    <div className="mt-3 border-t border-white/5 pt-3 flex gap-4 overflow-x-auto">
                      {m.rewardTxs.map((tx, i) => (
                        <div key={i} className="shrink-0 text-xs bg-white/5 rounded-lg px-3 py-1.5">
                          <span className="text-purple-300 font-medium">+{tx.amount} THR</span>
                          <span className="text-slate-400 ml-1">{tx.reason}</span>
                          <span className={`ml-1 ${
                            tx.status === "CONFIRMED" ? "text-green-400" :
                            tx.status === "FAILED" ? "text-red-400" : "text-amber-400"
                          }`}>• {tx.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reward Modal */}
      {rewardTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Αποστολή THR Reward</h3>
            <p className="text-sm text-slate-400 mb-4">
              Σε: <strong>{members.find((m) => m.id === rewardTarget)?.name}</strong>
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Ποσό (THR)</label>
                <input
                  type="number"
                  value={rewardAmt}
                  onChange={(e) => setRewardAmt(e.target.value)}
                  min="0.1"
                  step="0.1"
                  placeholder="10"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Αιτιολογία</label>
                <input
                  type="text"
                  value={rewardReason}
                  onChange={(e) => setRewardReason(e.target.value)}
                  placeholder="Bonus Μαΐου, Ολοκλήρωση jobs..."
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={sendReward}
                disabled={!rewardAmt || parseFloat(rewardAmt) <= 0 || sending}
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 font-semibold py-2.5 rounded-xl transition text-sm"
              >
                {sending ? "Αποστολή..." : "⚡ Αποστολή on-chain"}
              </button>
              <button
                onClick={() => { setRewardTarget(null); setRewardAmt(""); }}
                className="text-slate-400 hover:text-white px-4 transition text-sm"
              >
                Ακύρωση
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

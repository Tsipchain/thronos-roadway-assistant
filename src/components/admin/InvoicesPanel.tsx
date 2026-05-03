"use client";

import { useState } from "react";

type Tenant = { id: string; name: string; slug: string };

type Invoice = {
  id: string;
  number: string;
  description: string;
  amountEur: number;
  vatPct: number;
  totalEur: number;
  status: string;
  dueDate: string;
  paidAt: string | null;
  bankRef: string | null;
  createdAt: string;
  tenant: { name: string; slug: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Πρόχειρο",
  SENT: "Απεστάλη",
  PAID: "Πληρωμένο",
  OVERDUE: "Εκπρόθεσμο",
  CANCELLED: "Ακυρωμένο",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-500/20 text-slate-400",
  SENT: "bg-blue-500/20 text-blue-300",
  PAID: "bg-green-500/20 text-green-300",
  OVERDUE: "bg-red-500/20 text-red-300",
  CANCELLED: "bg-slate-600/20 text-slate-500",
};

export default function InvoicesPanel({
  invoices: initial,
  tenants,
}: {
  invoices: Invoice[];
  tenants: Tenant[];
}) {
  const [invoices, setInvoices] = useState(initial);
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [bankRef, setBankRef] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create invoice form state
  const [form, setForm] = useState({
    tenantId: tenants[0]?.id ?? "",
    description: "",
    amount: "",
    vatPct: "24",
    daysUntilDue: "14",
  });
  const [creating, setCreating] = useState(false);

  const filtered = filter === "ALL" ? invoices : invoices.filter((i) => i.status === filter);

  async function markPaid(invoiceId: string) {
    const ref = bankRef[invoiceId]?.trim();
    if (!ref) {
      setError("Εισάγετε αριθμό τραπεζικής συναλλαγής.");
      return;
    }
    setError(null);
    setLoading(invoiceId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankRef: ref }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Σφάλμα");
      setInvoices((prev) =>
        prev.map((i) =>
          i.id === invoiceId ? { ...i, status: "PAID", paidAt: new Date().toISOString(), bankRef: ref } : i
        )
      );
      setExpanded(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Σφάλμα");
    } finally {
      setLoading(null);
    }
  }

  async function createInvoice() {
    if (!form.tenantId || !form.description || !form.amount) {
      setError("Συμπληρώστε όλα τα πεδία.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const tenant = tenants.find((t) => t.id === form.tenantId);
      if (!tenant) throw new Error("Tenant not found");
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: form.tenantId,
          tenantSlug: tenant.slug,
          description: form.description,
          amountEur: parseFloat(form.amount),
          vatPct: parseFloat(form.vatPct),
          daysUntilDue: parseInt(form.daysUntilDue),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Σφάλμα");
      setInvoices((prev) => [data, ...prev]);
      setShowCreate(false);
      setForm({ tenantId: tenants[0]?.id ?? "", description: "", amount: "", vatPct: "24", daysUntilDue: "14" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Σφάλμα");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {/* Create Invoice Button */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2 flex-wrap">
          {["ALL", "DRAFT", "SENT", "PAID", "OVERDUE"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                filter === s
                  ? "border-blue-500 bg-blue-500/20 text-blue-200"
                  : "border-white/10 text-slate-400 hover:border-white/30"
              }`}
            >
              {s === "ALL" ? "Όλα" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setError(null); }}
          className="bg-blue-600 hover:bg-blue-500 text-sm font-medium px-4 py-2 rounded-xl transition"
        >
          + Νέο Τιμολόγιο
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white/5 border border-blue-500/30 rounded-2xl p-6 mb-6">
          <h3 className="font-semibold mb-4">Νέο Τιμολόγιο</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Tenant</label>
              <select
                value={form.tenantId}
                onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                className="w-full bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Ποσό (χωρίς ΦΠΑ) EUR</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="π.χ. 150.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-slate-400 mb-1 block">Περιγραφή</label>
              <input
                type="text"
                placeholder="π.χ. Μηνιαία συνδρομή Roadway Pro — Ιούνιος 2025"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">ΦΠΑ %</label>
              <select
                value={form.vatPct}
                onChange={(e) => setForm((f) => ({ ...f, vatPct: e.target.value }))}
                className="w-full bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="24">24%</option>
                <option value="13">13%</option>
                <option value="6">6%</option>
                <option value="0">0%</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Προθεσμία (μέρες)</label>
              <input
                type="number"
                min="1"
                value={form.daysUntilDue}
                onChange={(e) => setForm((f) => ({ ...f, daysUntilDue: e.target.value }))}
                className="w-full bg-slate-800 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          {form.amount && (
            <div className="mt-4 text-sm text-slate-300">
              Σύνολο με ΦΠΑ: <span className="font-bold text-white">
                {(parseFloat(form.amount || "0") * (1 + parseFloat(form.vatPct) / 100)).toFixed(2)} EUR
              </span>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button
              onClick={createInvoice}
              disabled={creating}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold px-5 py-2 rounded-lg transition"
            >
              {creating ? "Δημιουργία..." : "Δημιουργία Τιμολογίου"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="text-sm text-slate-400 hover:text-slate-200 px-4 py-2 transition"
            >
              Ακύρωση
            </button>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Δεν υπάρχουν τιμολόγια.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((inv) => (
              <div key={inv.id} className="border border-white/10 rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-5 py-4 hover:bg-white/5 transition"
                  onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${STATUS_COLORS[inv.status]}`}>
                        {STATUS_LABELS[inv.status]}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-xs text-slate-400">{inv.number}</div>
                        <div className="text-sm font-medium truncate">{inv.description}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold">{inv.totalEur.toFixed(2)} EUR</div>
                      <div className="text-xs text-slate-400">{inv.tenant?.name ?? "—"}</div>
                    </div>
                  </div>
                </button>

                {expanded === inv.id && (
                  <div className="px-5 pb-5 bg-black/20 border-t border-white/5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm mb-4">
                      <div>
                        <div className="text-slate-500 text-xs">Tenant</div>
                        <div>{inv.tenant?.name} ({inv.tenant?.slug})</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Καθαρό</div>
                        <div>{inv.amountEur.toFixed(2)} EUR</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">ΦΠΑ {inv.vatPct}%</div>
                        <div>{(inv.totalEur - inv.amountEur).toFixed(2)} EUR</div>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Προθεσμία</div>
                        <div>{new Date(inv.dueDate).toLocaleDateString("el-GR")}</div>
                      </div>
                      {inv.paidAt && (
                        <div>
                          <div className="text-slate-500 text-xs">Πληρώθηκε</div>
                          <div>{new Date(inv.paidAt).toLocaleDateString("el-GR")}</div>
                        </div>
                      )}
                      {inv.bankRef && (
                        <div>
                          <div className="text-slate-500 text-xs">Ref Τράπεζας</div>
                          <div className="font-mono text-xs">{inv.bankRef}</div>
                        </div>
                      )}
                    </div>

                    {["SENT", "OVERDUE"].includes(inv.status) && (
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <label className="text-xs text-slate-400 mb-1 block">Αριθμός Τραπεζικής Συναλλαγής</label>
                          <input
                            type="text"
                            placeholder="Bank ref / IBAN entry ID"
                            value={bankRef[inv.id] ?? ""}
                            onChange={(e) => setBankRef((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                            className="w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                          />
                        </div>
                        <button
                          onClick={() => markPaid(inv.id)}
                          disabled={loading === inv.id}
                          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-sm font-semibold px-5 py-2 rounded-lg transition"
                        >
                          {loading === inv.id ? "..." : "Επισήμανση ως Πληρωμένο"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

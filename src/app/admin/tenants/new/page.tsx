"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewTenantPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", slug: "", email: "", phone: "", vatNumber: "", billingAddress: "", plan: "starter",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Σφάλμα");
      router.push("/admin");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

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

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-white transition">← Admin</Link>
          <h1 className="text-xl font-bold">Νέος Partner</h1>
        </div>

        <form onSubmit={submit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
          {field("name", "Επωνυμία *", "text", "LK Shop")}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Slug (URL) *</label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-sm">/t/</span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "") }))}
                placeholder="lkshop"
                className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition font-mono"
                required
              />
            </div>
          </div>
          {field("email", "Email", "email", "info@lkshop.gr")}
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

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.name || !form.slug}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? "Δημιουργία..." : "Δημιουργία Partner →"}
          </button>
        </form>
      </div>
    </main>
  );
}

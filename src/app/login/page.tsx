"use client";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackUrl = params.get("callbackUrl") ?? "/admin";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Λάθος email ή κωδικός πρόσβασης.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs text-slate-400 block mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@lkshop.gr"
          className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition"
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-1">Κωδικός</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500 transition"
          required
          autoComplete="current-password"
        />
      </div>
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition"
      >
        {loading ? "Σύνδεση..." : "Σύνδεση →"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg shadow-purple-900/50">
            🔧
          </div>
          <h1 className="text-2xl font-bold">Thronos Roadway</h1>
          <p className="text-slate-400 text-sm mt-1">Είσοδος στο σύστημα</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl">
          <Suspense fallback={<div className="text-slate-400 text-sm">Φόρτωση...</div>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="text-center text-slate-600 text-xs mt-6">
          Powered by{" "}
          <span className="text-purple-500">Thronos Chain</span>
        </p>
      </div>
    </main>
  );
}

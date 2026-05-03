"use client";
import { useEffect, useRef } from "react";

type Props = {
  tenant: { name: string; slug: string; phone: string | null; logoUrl: string | null };
  sosUrl: string;
};

export default function QRPrintPage({ tenant, sosUrl }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const qrApiUrl = `/api/tenants/${tenant.slug}/qr?format=svg`;
  const qrPngUrl = `/api/tenants/${tenant.slug}/qr?format=png`;

  const download = async () => {
    const res = await fetch(qrPngUrl);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qr-sos-${tenant.slug}.png`;
    a.click();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <a href={`/t/${tenant.slug}/admin`} className="text-slate-400 hover:text-white transition">
            ← Admin
          </a>
          <h1 className="text-xl font-bold">QR Code SOS</h1>
        </div>

        {/* Printable card */}
        <div
          id="print-card"
          className="bg-white text-slate-900 rounded-3xl p-8 text-center shadow-2xl print:rounded-none print:shadow-none"
        >
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400 mb-2">
            24/7 Οδική Βοήθεια
          </p>
          <h2 className="text-3xl font-black mb-1">{tenant.name}</h2>
          {tenant.phone && (
            <p className="text-lg font-semibold text-purple-700 mb-6">{tenant.phone}</p>
          )}

          {/* QR code */}
          <div className="flex justify-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={qrApiUrl}
              alt="SOS QR Code"
              width={220}
              height={220}
              className="rounded-xl"
            />
          </div>

          <p className="text-sm text-slate-500 mb-1">Σκανάρετε για άμεση βοήθεια</p>
          <p className="text-xs font-mono text-slate-400 break-all">{sosUrl}</p>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-2">
            <span className="text-xs text-slate-400">Powered by</span>
            <span className="text-xs font-bold text-purple-600">Thronos Chain</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={download}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-semibold transition"
          >
            ↓ Λήψη PNG (512×512)
          </button>
          <button
            onClick={() => window.print()}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-semibold transition"
          >
            🖨 Εκτύπωση
          </button>
          <a
            href={sosUrl}
            target="_blank"
            className="bg-white/5 hover:bg-white/10 text-slate-300 px-6 py-3 rounded-xl font-semibold transition"
          >
            Άνοιγμα SOS ↗
          </a>
        </div>

        {/* Use cases */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: "🏪", label: "Κατάστημα", desc: "Αφίσα A4" },
            { icon: "🚐", label: "Van τεχνικού", desc: "Αυτοκόλλητο" },
            { icon: "🧾", label: "Τιμολόγιο", desc: "Footer" },
            { icon: "📱", label: "Social", desc: "Instagram / FB" },
          ].map((u) => (
            <div
              key={u.label}
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-center"
            >
              <div className="text-2xl mb-1">{u.icon}</div>
              <div className="text-sm font-medium">{u.label}</div>
              <div className="text-xs text-slate-500">{u.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; }
          #print-card { page-break-inside: avoid; }
          button, a[href]:not(#print-card a) { display: none !important; }
        }
      `}</style>
    </main>
  );
}

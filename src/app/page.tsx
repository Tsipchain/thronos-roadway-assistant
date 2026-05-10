"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "@/hooks/useLocale";
import { COUNTRIES, SERVICE_ICONS, type LocaleKey, LOCALES } from "@/i18n/translations";

type Partner = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
  onlineTechs: number;
  minPrice: number | null;
  serviceTypes: string[];
  cities: string[];
  avgSla: number;
};

export default function DiscoverPage() {
  const { locale, setLocale, t } = useLocale();

  const [country,  setCountry]  = useState("GR");
  const [city,     setCity]     = useState("");
  const [service,  setService]  = useState("");
  const [results,  setResults]  = useState<Partner[] | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // Close lang dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-detect country from timezone
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if      (tz.includes("Athens"))    setCountry("GR");
      else if (tz.includes("Nicosia"))   setCountry("CY");
      else if (tz.includes("Berlin"))    setCountry("DE");
      else if (tz.includes("Rome"))      setCountry("IT");
      else if (tz.includes("Paris"))     setCountry("FR");
      else if (tz.includes("Madrid"))    setCountry("ES");
      else if (tz.includes("Warsaw"))    setCountry("PL");
      else if (tz.includes("Bucharest")) setCountry("RO");
      else if (tz.includes("Sofia"))     setCountry("BG");
      else if (tz.includes("Tirane"))    setCountry("AL");
    } catch {}
  }, []);

  const search = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const q = new URLSearchParams({ country });
      if (city)    q.set("city", city);
      if (service) q.set("service", service);
      const res = await fetch(`/api/discover?${q}`);
      if (res.ok) setResults((await res.json()).results);
    } catch {}
    setLoading(false);
  };

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const SERVICES = ["BATTERY_REPLACEMENT", "BATTERY_CHARGE", "TIRE_CHANGE", "TIRE_REPAIR", "DIAGNOSIS"];

  return (
    <div className="min-h-screen bg-slate-950 text-white">

      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-lg tracking-tight">Roadway</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs text-slate-400 hover:text-white transition">
              {t.for_business}
            </Link>
            {/* Language switcher */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen((v) => !v)}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-sm transition"
              >
                <span>{LOCALES[locale].flag}</span>
                <span className="hidden sm:inline text-sm">{LOCALES[locale].name}</span>
                <span className="text-slate-500 text-xs">▾</span>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl w-44 overflow-hidden z-50">
                  {(Object.entries(LOCALES) as [LocaleKey, { name: string; flag: string }][]).map(([code, info]) => (
                    <button
                      key={code}
                      onClick={() => { setLocale(code); setLangOpen(false); }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition text-left ${locale === code ? "text-indigo-300" : "text-slate-300"}`}
                    >
                      <span>{info.flag}</span>
                      <span>{info.name}</span>
                      {locale === code && <span className="ml-auto text-indigo-400 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 text-xs text-indigo-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
          24/7 · GPS Dispatch · Blockchain Record
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
          {t.hero_title}
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-10">
          {t.hero_subtitle}
        </p>

        {/* Search card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto shadow-2xl">

          {/* Service selector */}
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 text-left">{t.select_service}</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
            <button
              onClick={() => setService("")}
              className={`p-3 rounded-xl border text-center transition ${
                service === ""
                  ? "bg-indigo-600/30 border-indigo-500/60 text-indigo-300"
                  : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
              }`}
            >
              <div className="text-xl mb-1">🚗</div>
              <div className="text-xs font-medium">{t.all_services.split(" ")[0]}</div>
            </button>
            {SERVICES.map((s) => (
              <button
                key={s}
                onClick={() => setService(s === service ? "" : s)}
                className={`p-3 rounded-xl border text-center transition ${
                  service === s
                    ? "bg-indigo-600/30 border-indigo-500/60 text-indigo-300"
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                }`}
              >
                <div className="text-xl mb-1">{SERVICE_ICONS[s]}</div>
                <div className="text-xs font-medium truncate">{t.services[s as keyof typeof t.services].split(" ")[0]}</div>
              </button>
            ))}
          </div>

          {/* Location row */}
          <div className="flex gap-2 mb-4">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.names[locale]}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder={t.search_city}
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            onClick={search}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold text-base transition"
          >
            {loading ? t.loading : `${t.search_cta} ${selectedCountry?.flag ?? ""}`}
          </button>
        </div>
      </section>

      {/* Results */}
      {searched && (
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <h2 className="text-lg font-semibold mb-4 text-slate-300">
            {loading
              ? t.loading
              : results && results.length > 0
                ? `${t.available_partners} · ${results.length}`
                : t.no_results
            }
          </h2>

          {!loading && results && results.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((partner) => (
                <PartnerCard key={partner.id} partner={partner} t={t} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-600">
        <p>{t.powered_by} · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

function PartnerCard({
  partner,
  t,
}: {
  partner: Partner;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const isAvailable = partner.onlineTechs > 0;

  return (
    <Link
      href={`/t/${partner.slug}`}
      className="group bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col gap-4 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {partner.logoUrl ? (
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 shrink-0">
              <Image src={partner.logoUrl} alt={partner.name} width={48} height={48} className="object-cover w-full h-full" unoptimized />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center text-xl font-bold shrink-0">
              {partner.name[0]}
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{partner.name}</div>
            {partner.cities.length > 0 && (
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {t.covers}: {partner.cities.slice(0, 3).join(", ")}
                {partner.cities.length > 3 && ` +${partner.cities.length - 3}`}
              </div>
            )}
          </div>
        </div>

        <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
          isAvailable ? "bg-green-500/20 text-green-300" : "bg-slate-500/20 text-slate-400"
        }`}>
          {isAvailable ? `● ${partner.onlineTechs}` : "○"} {t.online_techs}
        </span>
      </div>

      {/* Services */}
      {partner.serviceTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {partner.serviceTypes.slice(0, 5).map((s) => (
            <span key={s} className="text-xs bg-slate-800 px-2 py-1 rounded-lg text-slate-300">
              {SERVICE_ICONS[s]} {t.services[s as keyof typeof t.services]?.split(" ")[0]}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
        <div className="text-xs text-slate-500 space-x-2">
          {partner.avgSla > 0 && <span>~{partner.avgSla} min</span>}
          {partner.minPrice !== null && (
            <span>{t.from_price} <span className="text-white font-semibold">{partner.minPrice}€</span></span>
          )}
        </div>
        <span className="text-xs text-indigo-400 group-hover:text-indigo-300 font-semibold transition">
          {t.book_now}
        </span>
      </div>
    </Link>
  );
}

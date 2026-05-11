"use client";

import { useState, useEffect, useCallback } from "react";
import { translations, LOCALES, type LocaleKey } from "@/i18n/translations";

const STORAGE_KEY = "roadway_locale";
const COOKIE_NAME = "roadway_locale";

function setCookie(value: string) {
  document.cookie = `${COOKIE_NAME}=${value};path=/;max-age=${60*60*24*365};samesite=lax`;
}

function detectLocale(): LocaleKey {
  if (typeof window === "undefined") return "el";
  const saved = localStorage.getItem(STORAGE_KEY) as LocaleKey;
  if (saved && saved in LOCALES) return saved;
  const lang = navigator.language.slice(0, 2) as LocaleKey;
  return lang in LOCALES ? lang : "el";
}

export function useLocale() {
  const [locale, setLocaleState] = useState<LocaleKey>("el");

  useEffect(() => {
    const detected = detectLocale();
    setLocaleState(detected);
    setCookie(detected);
  }, []);

  const setLocale = useCallback((l: LocaleKey) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
    setCookie(l);
  }, []);

  return { locale, setLocale, t: translations[locale], locales: LOCALES };
}

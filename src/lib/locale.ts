import { cookies, headers } from "next/headers";
import { translations, type LocaleKey } from "@/i18n/translations";

const SUPPORTED: LocaleKey[] = ["el","en","de","ro","bg","sq","pl","it","es","fr"];
const COOKIE = "roadway_locale";

export function getServerLocale(): LocaleKey {
  // 1. Cookie (set by client or middleware)
  const cookie = cookies().get(COOKIE)?.value as LocaleKey | undefined;
  if (cookie && SUPPORTED.includes(cookie)) return cookie;

  // 2. Header set by middleware
  const header = headers().get("x-locale") as LocaleKey | undefined;
  if (header && SUPPORTED.includes(header)) return header;

  return "el";
}

/** Use in Server Components: const t = getT(); */
export function getT() {
  return translations[getServerLocale()];
}

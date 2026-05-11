import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const SUPPORTED_LOCALES = ["el","en","de","ro","bg","sq","pl","it","es","fr"];
const LOCALE_COOKIE     = "roadway_locale";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path  = req.nextUrl.pathname;

    // Detect locale and carry it forward (client may set cookie; Accept-Language as fallback)
    const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
    const acceptLang   = req.headers.get("accept-language")?.slice(0, 2).toLowerCase() ?? "el";
    const locale       = (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale))
      ? cookieLocale
      : (SUPPORTED_LOCALES.includes(acceptLang) ? acceptLang : "el");

    let res: NextResponse;

    // /admin → SUPER_ADMIN only; redirect others to their correct dashboard
    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      if (token?.tenantSlug) {
        if (token.role === "ADMIN") {
          res = NextResponse.redirect(new URL(`/t/${token.tenantSlug}/admin`, req.url));
        } else if (token.role === "TECHNICIAN") {
          res = NextResponse.redirect(new URL(`/t/${token.tenantSlug}/tech`, req.url));
        } else {
          res = NextResponse.redirect(new URL("/login", req.url));
        }
      } else {
        res = NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // /t/[slug]/admin → ADMIN (matching tenant) or SUPER_ADMIN
    else {
      const tenantAdminMatch = path.match(/^\/t\/([^/]+)\/admin/);
      if (tenantAdminMatch) {
        const slug = tenantAdminMatch[1];
        if (
          token?.role !== "SUPER_ADMIN" &&
          !(token?.role === "ADMIN" && token?.tenantSlug === slug)
        ) {
          res = NextResponse.redirect(new URL("/login", req.url));
        } else {
          res = NextResponse.next();
        }
      }

      // /t/[slug]/tech → TECHNICIAN (matching tenant) or SUPER_ADMIN
      else {
        const tenantTechMatch = path.match(/^\/t\/([^/]+)\/tech/);
        if (tenantTechMatch) {
          const slug = tenantTechMatch[1];
          if (
            token?.role !== "SUPER_ADMIN" &&
            !(token?.role === "TECHNICIAN" && token?.tenantSlug === slug)
          ) {
            res = NextResponse.redirect(new URL("/login", req.url));
          } else {
            res = NextResponse.next();
          }
        } else {
          res = NextResponse.next();
        }
      }
    }

    // Always stamp locale on the response for server components
    res.headers.set("x-locale", locale);
    if (!cookieLocale) {
      res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    }

    return res;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/t/:path*/admin/:path*", "/t/:path*/tech/:path*", "/dashboard"],
};


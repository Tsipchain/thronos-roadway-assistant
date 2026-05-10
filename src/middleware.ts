import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // /admin → SUPER_ADMIN only; redirect others to their correct dashboard
    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      if (token?.tenantSlug) {
        if (token.role === "ADMIN") {
          return NextResponse.redirect(new URL(`/t/${token.tenantSlug}/admin`, req.url));
        }
        if (token.role === "TECHNICIAN") {
          return NextResponse.redirect(new URL(`/t/${token.tenantSlug}/tech`, req.url));
        }
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // /t/[slug]/admin → ADMIN (matching tenant) or SUPER_ADMIN
    const tenantAdminMatch = path.match(/^\/t\/([^\/]+)\/admin/);
    if (tenantAdminMatch) {
      const slug = tenantAdminMatch[1];
      if (
        token?.role !== "SUPER_ADMIN" &&
        !(token?.role === "ADMIN" && token?.tenantSlug === slug)
      ) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // /t/[slug]/tech → TECHNICIAN (matching tenant) or SUPER_ADMIN
    const tenantTechMatch = path.match(/^\/t\/([^\/]+)\/tech/);
    if (tenantTechMatch) {
      const slug = tenantTechMatch[1];
      if (
        token?.role !== "SUPER_ADMIN" &&
        !(token?.role === "TECHNICIAN" && token?.tenantSlug === slug)
      ) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // /dashboard → any authenticated user (handled in page)
    return NextResponse.next();
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

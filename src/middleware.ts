import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // /admin requires SUPER_ADMIN
    if (path.startsWith("/admin") && token?.role !== "SUPER_ADMIN") {
      // Redirect tenant admins to their own dashboard
      if (token?.tenantSlug && (token.role === "ADMIN" || token.role === "TECHNICIAN")) {
        return NextResponse.redirect(
          new URL(`/t/${token.tenantSlug}/admin`, req.url)
        );
      }
      return NextResponse.redirect(new URL("/login", req.url));
    }

    // /t/[slug]/admin requires ADMIN or SUPER_ADMIN, and matching tenant
    const tenantAdminMatch = path.match(/^\/t\/([^\/]+)\/admin/);
    if (tenantAdminMatch) {
      const slug = tenantAdminMatch[1];
      if (
        token?.role !== "SUPER_ADMIN" &&
        !((
          token?.role === "ADMIN" || token?.role === "TECHNICIAN"
        ) && token?.tenantSlug === slug)
      ) {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/t/:path*/admin/:path*"],
};

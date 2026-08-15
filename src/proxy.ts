import { auth } from "@/lib/auth";
import { getBasePath, isPublicSitePath, stripBasePath } from "@/lib/base-path";
import { NextResponse } from "next/server";

function isOperatorRoute(routePath: string): boolean {
  return (
    routePath === "/login" ||
    routePath.startsWith("/login/") ||
    routePath.startsWith("/dashboard") ||
    routePath.startsWith("/api/")
  );
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const routePath = stripBasePath(pathname);
  const basePath = getBasePath();

  if (basePath && !isOperatorRoute(routePath) && isPublicSitePath(routePath)) {
    const dest = routePath === "" ? "/" : routePath;
    return NextResponse.redirect(new URL(dest, req.nextUrl.origin), 308);
  }

  const isProtected = routePath.startsWith("/dashboard");
  const isLoginPage = routePath === "/login";

  if (isProtected && !isLoggedIn) {
    // Absolute URL must include basePath; callbackUrl must be app-relative
    // so client router.push does not double-prefix.
    const loginUrl = new URL(`${basePath}/login`, req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", routePath);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && isLoggedIn) {
    return NextResponse.redirect(new URL(`${basePath}/dashboard`, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/",
    "/work",
    "/work/:path*",
    "/services",
    "/services/:path*",
    "/contact",
    "/contact/:path*",
    "/campaigns",
    "/campaigns/:path*",
    "/proof",
    "/proof/:path*",
    "/demos",
    "/demos/:path*",
    "/privacy",
    "/privacy/:path*",
    "/terms",
    "/terms/:path*",
    "/data-deletion",
    "/data-deletion/:path*",
    "/dashboard/:path*",
    "/login",
  ],
};

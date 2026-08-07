import { auth } from "@/lib/auth";
import { getBasePath, stripBasePath } from "@/lib/base-path";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const routePath = stripBasePath(pathname);
  const basePath = getBasePath();

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

// Only dashboard and login — /api/auth/* is intentionally excluded so NextAuth handles sign-in
export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};

import { handlers } from "@/lib/auth";
import { getBasePath } from "@/lib/base-path";
import { NextRequest } from "next/server";

/**
 * Auth.js + Next.js basePath: the framework strips basePath from the request
 * URL seen by route handlers, while AUTH_URL with a path prefix makes Auth.js
 * expect that prefix. Rewrite the request URL so Auth.js sees the public path
 * and forwarded host.
 */
function rewriteRequest(request: NextRequest): NextRequest {
  const basePath = getBasePath();
  const { protocol, host, pathname, search } = request.nextUrl;
  const headers = request.headers;
  const detectedHost = headers.get("x-forwarded-host") ?? host;
  const detectedProtocol = headers.get("x-forwarded-proto") ?? protocol;
  const proto = detectedProtocol.endsWith(":") ? detectedProtocol : `${detectedProtocol}:`;
  const pathWithBase =
    basePath && !pathname.startsWith(`${basePath}/`) && pathname !== basePath
      ? `${basePath}${pathname}`
      : pathname;
  const url = new URL(`${proto}//${detectedHost}${pathWithBase}${search}`);
  return new NextRequest(url, request);
}

export async function GET(request: NextRequest) {
  return handlers.GET(rewriteRequest(request));
}

export async function POST(request: NextRequest) {
  return handlers.POST(rewriteRequest(request));
}

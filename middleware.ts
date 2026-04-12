import { NextResponse, type NextRequest } from "next/server";

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "host.docker.internal",
]);

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".local");
}

function getRequestHostnames(request: NextRequest): string[] {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hosts = [request.nextUrl.hostname];

  if (forwardedHost) {
    hosts.push(...forwardedHost.split(",").map((value) => value.trim()));
  }

  return hosts.filter(Boolean).map((value) => value.toLowerCase());
}

export function middleware(request: NextRequest) {
  if (process.env.ALLOW_REMOTE_ACCESS !== "false") {
    return NextResponse.next();
  }

  if (getRequestHostnames(request).every(isLocalHostname)) {
    return NextResponse.next();
  }

  return NextResponse.json(
    {
      error:
        "Remote access is disabled. This app defaults to local-only mode unless ALLOW_REMOTE_ACCESS=true is set.",
    },
    { status: 403 },
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

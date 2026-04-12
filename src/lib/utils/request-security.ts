import { NextResponse } from "next/server";
import { getConfig } from "./config";

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "host.docker.internal",
]);

const globalRateLimitStore = globalThis as unknown as {
  __peeRateLimitStore?: Map<string, number[]>;
};

function getRateLimitStore(): Map<string, number[]> {
  if (!globalRateLimitStore.__peeRateLimitStore) {
    globalRateLimitStore.__peeRateLimitStore = new Map();
  }

  return globalRateLimitStore.__peeRateLimitStore;
}

function getRequestHostnames(request: Request): string[] {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hosts = [url.hostname];

  if (forwardedHost) {
    hosts.push(...forwardedHost.split(",").map((value) => value.trim()));
  }

  return hosts.filter(Boolean).map((value) => value.toLowerCase());
}

function getClientIdentity(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim().toLowerCase() ?? "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim().toLowerCase();
  }

  return getRequestHostnames(request)[0] ?? "unknown";
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".local");
}

export function isLocalOriginRequest(request: Request): boolean {
  return getRequestHostnames(request).every(isLocalHostname);
}

function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const store = getRateLimitStore();
  const timestamps = (store.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

  if (timestamps.length >= limit) {
    const retryAfterMs = Math.max(0, timestamps[0] + windowMs - now);
    store.set(key, timestamps);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  timestamps.push(now);
  store.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function isTrustedLocalRequest(request: Request): boolean {
  const { allowRemoteAccess } = getConfig();
  if (allowRemoteAccess) {
    return true;
  }

  return isLocalOriginRequest(request);
}

export function requireTrustedLocalRequest(
  request: Request,
  scope: string,
): NextResponse | null {
  if (isTrustedLocalRequest(request)) {
    return null;
  }

  return NextResponse.json(
    {
      error:
        `${scope} is disabled for remote access. This app defaults to local-only mode. ` +
        `Set ALLOW_REMOTE_ACCESS=true only if you also add your own auth layer.`,
    },
    { status: 403 },
  );
}

export function enforceRouteRateLimit(
  request: Request,
  scope: string,
  options: { limit: number; windowMs: number },
): NextResponse | null {
  const identity = getClientIdentity(request);
  const result = consumeRateLimit(
    `${scope}:${identity}`,
    options.limit,
    options.windowMs,
  );

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      error: `Rate limit exceeded for ${scope}. Retry in ${result.retryAfterSeconds}s.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

export function normalizeOllamaBaseUrl(baseUrl: string): string {
  const { allowRemoteAccess, ollamaAllowedHosts } = getConfig();

  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("ollamaBaseUrl must be a valid absolute URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("ollamaBaseUrl must use http or https");
  }

  if (parsed.username || parsed.password) {
    throw new Error("ollamaBaseUrl cannot include credentials");
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("ollamaBaseUrl must not include a path, query, or hash");
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLocal = isLocalHostname(hostname);
  const isAllowlisted = ollamaAllowedHosts.includes(hostname);

  if (!isLocal && !isAllowlisted) {
    if (!allowRemoteAccess) {
      throw new Error(
        "ollamaBaseUrl must point to localhost in local-only mode",
      );
    }

    throw new Error(
      "ollamaBaseUrl host is not allowlisted. Add it to OLLAMA_ALLOWED_HOSTS to enable remote Ollama.",
    );
  }

  return parsed.origin;
}

/**
 * Centralized CSRF protection — Origin / Referer validation.
 *
 * Browser-authenticated API routes rely on the NextAuth session cookie.  A
 * malicious page can trick the user's browser into sending cookie-authenticated
 * requests to those routes (CSRF).  This module guards against that by
 * comparing the Origin (or fallback Referer) of every mutation request against
 * a set of trusted origins derived from environment configuration.
 *
 * ─── Exemptions ────────────────────────────────────────────────────────────
 * Routes that authenticate through non-cookie mechanisms are excluded because
 * they cannot be attacked via CSRF:
 *
 *   /api/webhooks/github         — HMAC signature (x-hub-signature-256)
 *   /api/cron/*                  — Bearer CRON_SECRET
 *   /api/wakatime/sync           — Bearer CRON_SECRET
 *   /api/sponsors/sync           — Bearer CRON_SECRET
 *   /api/notifications/discord-sync — Bearer CRON_SECRET
 *   /api/local-coding/sync       — Bearer API-key
 *   /api/auth/*                  — NextAuth internal endpoints
 *
 * Any request carrying an `Authorization: Bearer …` header is also exempt:
 * machine clients cannot be tricked into attaching a browser session cookie,
 * which is the vector CSRF exploits.
 *
 * ─── Configuration ─────────────────────────────────────────────────────────
 * Trusted origins are built from:
 *   NEXTAUTH_URL         — required; canonical app origin
 *   NEXT_PUBLIC_APP_URL  — optional; alternate public origin
 *   ALLOWED_ORIGINS      — comma-separated list of additional trusted origins
 *                          e.g. http://localhost:3000,https://devtrack.app
 *
 * In non-production environments, http://localhost:3000 and
 * http://127.0.0.1:3000 are always trusted.
 */

/** HTTP methods that mutate server state and require CSRF validation. */
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Path prefixes that are exempt from Origin/Referer validation.
 * These routes authenticate via HMAC signatures or bearer tokens, not cookies.
 */
const CSRF_EXEMPT_PREFIXES: readonly string[] = [
  "/api/webhooks/github",            // GitHub HMAC-signed push deliveries
  "/api/cron/",                      // Vercel / external cron (Bearer CRON_SECRET)
  "/api/wakatime/sync",              // Cron-triggered WakaTime sync
  "/api/sponsors/sync",              // Cron-triggered sponsor sync
  "/api/notifications/discord-sync", // Cron-triggered Discord notification sync
  "/api/local-coding/sync",          // Local editor agent (Bearer API-key)
  "/api/auth/",                      // NextAuth internal endpoints
];

/**
 * Build the set of trusted origins from environment variables.
 * Called on each validation so configuration changes take effect immediately.
 */
function buildTrustedOrigins(): Set<string> {
  const origins = new Set<string>();

  for (const raw of [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!raw) continue;
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // Ignore malformed URLs.
    }
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS;
  if (allowedOrigins) {
    for (const raw of allowedOrigins.split(",")) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        origins.add(new URL(trimmed).origin);
      } catch {
        // Ignore malformed entries.
      }
    }
  }

  // Localhost variants are always trusted outside production so that local
  // development and test runs work without extra configuration.
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

/**
 * Returns true when the given HTTP method can mutate server state.
 */
export function isMutationMethod(method: string): boolean {
  return MUTATION_METHODS.has(method.toUpperCase());
}

/**
 * Returns true when the path is on the CSRF exempt list.
 * Exempt routes authenticate via mechanisms other than browser session cookies.
 */
export function isCsrfExemptPath(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Validate the Origin / Referer header of a mutation request.
 *
 * Returns null when the request is allowed, or an error string when it should
 * be rejected with a 403 response.
 *
 * Decision table
 * ──────────────
 * • Not a mutation method (GET, HEAD, OPTIONS)   → null (pass through)
 * • Authorization: Bearer header present         → null (machine client exempt)
 * • Origin header present, matches trusted set   → null
 * • Origin header present, not in trusted set    → error string
 * • No Origin, Referer present, matches trusted  → null
 * • No Origin, Referer present, untrusted        → error string
 * • No Origin, no Referer                        → null (server-side / native client)
 *
 * Note on the "no headers" case: same-origin server-side fetches, some native
 * mobile clients, and certain reverse-proxy configurations do not forward
 * Origin or Referer.  These cannot be cross-site attacks, so we allow them
 * rather than breaking legitimate callers.
 */
export function checkCsrfOrigin(
  req: Pick<Request, "method"> & { headers: { get(name: string): string | null } }
): string | null {
  if (!isMutationMethod(req.method)) return null;

  // Machine clients authenticate via Authorization: Bearer — they cannot be
  // weaponised via CSRF because the attack exploits cookie auto-attachment.
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) return null;

  const trustedOrigins = buildTrustedOrigins();

  // Origin is the canonical CSRF signal; all modern browsers send it for
  // cross-origin requests and for same-origin XMLHttpRequest / fetch.
  const origin = req.headers.get("origin");
  if (origin !== null) {
    return trustedOrigins.has(origin)
      ? null
      : "Forbidden: request origin is not trusted";
  }

  // Fall back to Referer for environments that strip Origin (older Safari,
  // some reverse proxies).
  const referer = req.headers.get("referer");
  if (referer !== null) {
    try {
      const refererOrigin = new URL(referer).origin;
      return trustedOrigins.has(refererOrigin)
        ? null
        : "Forbidden: request origin is not trusted";
    } catch {
      return "Forbidden: malformed Referer header";
    }
  }

  // No Origin or Referer — allow rather than blocking legitimate non-browser
  // callers that cannot be responsible for a cross-site attack.
  return null;
}

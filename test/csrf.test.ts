/**
 * Regression tests for the centralized CSRF protection module.
 *
 * Covers:
 *   - isMutationMethod  — correct classification of HTTP verbs
 *   - isCsrfExemptPath  — exempt-path allowlist accuracy
 *   - checkCsrfOrigin   — Origin validation, Referer fallback, bearer exemption
 *     covering: trusted origin, untrusted origin, missing headers, ALLOWED_ORIGINS,
 *     NEXT_PUBLIC_APP_URL, each mutation method, and precedence rules
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  checkCsrfOrigin,
  isCsrfExemptPath,
  isMutationMethod,
} from "@/lib/csrf";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type FakeHeaders = Record<string, string>;

/** Build a minimal Request-compatible stub accepted by checkCsrfOrigin. */
function makeReq(
  method: string,
  headers: FakeHeaders = {}
): Parameters<typeof checkCsrfOrigin>[0] {
  const map = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    method,
    headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null },
  };
}

// ─── isMutationMethod ─────────────────────────────────────────────────────────

describe("isMutationMethod", () => {
  it("returns true for POST", () => expect(isMutationMethod("POST")).toBe(true));
  it("returns true for PUT", () => expect(isMutationMethod("PUT")).toBe(true));
  it("returns true for PATCH", () => expect(isMutationMethod("PATCH")).toBe(true));
  it("returns true for DELETE", () => expect(isMutationMethod("DELETE")).toBe(true));

  it("returns false for GET", () => expect(isMutationMethod("GET")).toBe(false));
  it("returns false for HEAD", () => expect(isMutationMethod("HEAD")).toBe(false));
  it("returns false for OPTIONS", () => expect(isMutationMethod("OPTIONS")).toBe(false));

  it("is case-insensitive (post)", () => expect(isMutationMethod("post")).toBe(true));
  it("is case-insensitive (delete)", () => expect(isMutationMethod("delete")).toBe(true));
});

// ─── isCsrfExemptPath ────────────────────────────────────────────────────────

describe("isCsrfExemptPath — exempt routes", () => {
  it("exempts the GitHub webhook route", () =>
    expect(isCsrfExemptPath("/api/webhooks/github")).toBe(true));

  it("exempts cron sub-routes", () =>
    expect(isCsrfExemptPath("/api/cron/weekly-digest")).toBe(true));

  it("exempts the WakaTime sync route", () =>
    expect(isCsrfExemptPath("/api/wakatime/sync")).toBe(true));

  it("exempts the sponsors sync route", () =>
    expect(isCsrfExemptPath("/api/sponsors/sync")).toBe(true));

  it("exempts the Discord-sync route", () =>
    expect(isCsrfExemptPath("/api/notifications/discord-sync")).toBe(true));

  it("exempts the local-coding sync route", () =>
    expect(isCsrfExemptPath("/api/local-coding/sync")).toBe(true));

  it("exempts NextAuth internal routes", () =>
    expect(isCsrfExemptPath("/api/auth/signin")).toBe(true));

  it("exempts NextAuth callback routes", () =>
    expect(isCsrfExemptPath("/api/auth/callback/github")).toBe(true));
});

describe("isCsrfExemptPath — protected routes (must NOT be exempt)", () => {
  it("does not exempt /api/goals (POST)", () =>
    expect(isCsrfExemptPath("/api/goals")).toBe(false));

  it("does not exempt /api/goals/[id] (PATCH/DELETE)", () =>
    expect(isCsrfExemptPath("/api/goals/abc-123")).toBe(false));

  it("does not exempt /api/user/settings (PATCH)", () =>
    expect(isCsrfExemptPath("/api/user/settings")).toBe(false));

  it("does not exempt /api/user/data-export (DELETE)", () =>
    expect(isCsrfExemptPath("/api/user/data-export")).toBe(false));

  it("does not exempt /api/daily-note (POST)", () =>
    expect(isCsrfExemptPath("/api/daily-note")).toBe(false));

  it("does not exempt /api/local-coding/keys (POST/DELETE)", () =>
    expect(isCsrfExemptPath("/api/local-coding/keys")).toBe(false));

  it("does not exempt /api/webhooks/custom (POST)", () =>
    expect(isCsrfExemptPath("/api/webhooks/custom")).toBe(false));

  it("does not exempt /api/notifications (PATCH)", () =>
    expect(isCsrfExemptPath("/api/notifications")).toBe(false));

  it("does not exempt /api/notifications/[id] (PATCH/DELETE)", () =>
    expect(isCsrfExemptPath("/api/notifications/uuid-here")).toBe(false));

  it("does not exempt /api/streak/freeze (POST/DELETE)", () =>
    expect(isCsrfExemptPath("/api/streak/freeze")).toBe(false));

  it("does not exempt /api/integrations/jira/credentials (POST/DELETE)", () =>
    expect(isCsrfExemptPath("/api/integrations/jira/credentials")).toBe(false));

  it("does not exempt /api/rooms (POST)", () =>
    expect(isCsrfExemptPath("/api/rooms")).toBe(false));

  it("does not exempt /api/goals/sync (POST)", () =>
    expect(isCsrfExemptPath("/api/goals/sync")).toBe(false));
});

// ─── checkCsrfOrigin ─────────────────────────────────────────────────────────

const TRUSTED = "http://localhost:3000";
const UNTRUSTED = "https://evil.example.com";

describe("checkCsrfOrigin — GET requests are never blocked", () => {
  it("allows GET with no headers", () =>
    expect(checkCsrfOrigin(makeReq("GET"))).toBeNull());

  it("allows GET even with an untrusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("GET", { origin: UNTRUSTED }))).toBeNull());
});

describe("checkCsrfOrigin — Bearer-token exemption", () => {
  it("allows POST with Bearer token regardless of untrusted Origin", () =>
    expect(
      checkCsrfOrigin(
        makeReq("POST", { authorization: "Bearer api-key", origin: UNTRUSTED })
      )
    ).toBeNull());

  it("allows DELETE with Bearer token and no Origin", () =>
    expect(
      checkCsrfOrigin(makeReq("DELETE", { authorization: "Bearer cron-secret" }))
    ).toBeNull());

  it("allows PATCH with Bearer token and untrusted Referer", () =>
    expect(
      checkCsrfOrigin(
        makeReq("PATCH", {
          authorization: "Bearer key",
          referer: `${UNTRUSTED}/attack`,
        })
      )
    ).toBeNull());

  it("does not apply the exemption for non-Bearer Authorization schemes", () => {
    // Basic auth is not a machine-client pattern in this codebase.
    const result = checkCsrfOrigin(
      makeReq("POST", {
        authorization: "Basic dXNlcjpwYXNz",
        origin: UNTRUSTED,
      })
    );
    expect(result).not.toBeNull();
  });
});

describe("checkCsrfOrigin — trusted Origin header", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = TRUSTED;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
  });

  it("allows POST with trusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("POST", { origin: TRUSTED }))).toBeNull());

  it("allows PUT with trusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("PUT", { origin: TRUSTED }))).toBeNull());

  it("allows PATCH with trusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("PATCH", { origin: TRUSTED }))).toBeNull());

  it("allows DELETE with trusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("DELETE", { origin: TRUSTED }))).toBeNull());
});

describe("checkCsrfOrigin — untrusted Origin header", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = TRUSTED;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
  });

  it("rejects POST with untrusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("POST", { origin: UNTRUSTED }))).not.toBeNull());

  it("rejects PUT with untrusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("PUT", { origin: UNTRUSTED }))).not.toBeNull());

  it("rejects PATCH with untrusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("PATCH", { origin: UNTRUSTED }))).not.toBeNull());

  it("rejects DELETE with untrusted Origin", () =>
    expect(checkCsrfOrigin(makeReq("DELETE", { origin: UNTRUSTED }))).not.toBeNull());

  it("error message mentions trust", () => {
    const error = checkCsrfOrigin(makeReq("POST", { origin: UNTRUSTED }));
    expect(error).toMatch(/trusted|Forbidden/i);
  });
});

describe("checkCsrfOrigin — Referer fallback (no Origin header)", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = TRUSTED;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
  });

  it("allows POST with trusted Referer when Origin is absent", () =>
    expect(
      checkCsrfOrigin(makeReq("POST", { referer: `${TRUSTED}/dashboard` }))
    ).toBeNull());

  it("rejects POST with untrusted Referer when Origin is absent", () =>
    expect(
      checkCsrfOrigin(makeReq("POST", { referer: `${UNTRUSTED}/attack` }))
    ).not.toBeNull());

  it("rejects POST with malformed Referer", () =>
    expect(
      checkCsrfOrigin(makeReq("POST", { referer: "not-a-valid-url" }))
    ).not.toBeNull());
});

describe("checkCsrfOrigin — Origin takes precedence over Referer", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = TRUSTED;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
  });

  it("trusted Origin passes even when Referer is untrusted", () =>
    expect(
      checkCsrfOrigin(
        makeReq("POST", { origin: TRUSTED, referer: `${UNTRUSTED}/evil` })
      )
    ).toBeNull());

  it("untrusted Origin blocks even when Referer is trusted", () =>
    expect(
      checkCsrfOrigin(
        makeReq("POST", { origin: UNTRUSTED, referer: `${TRUSTED}/page` })
      )
    ).not.toBeNull());
});

describe("checkCsrfOrigin — no Origin or Referer", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_URL = TRUSTED;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
  });

  it("allows POST with no headers (server-side / native client)", () =>
    expect(checkCsrfOrigin(makeReq("POST"))).toBeNull());

  it("allows DELETE with no headers", () =>
    expect(checkCsrfOrigin(makeReq("DELETE"))).toBeNull());
});

describe("checkCsrfOrigin — ALLOWED_ORIGINS configuration", () => {
  const EXTRA = "https://app.devtrack.io";
  const EXTRA2 = "https://beta.devtrack.app";

  beforeEach(() => {
    process.env.NEXTAUTH_URL = TRUSTED;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.ALLOWED_ORIGINS;
  });

  it("trusts a single origin listed in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = EXTRA;
    expect(checkCsrfOrigin(makeReq("POST", { origin: EXTRA }))).toBeNull();
  });

  it("trusts multiple comma-separated origins in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = `${EXTRA}, ${EXTRA2}`;
    expect(checkCsrfOrigin(makeReq("POST", { origin: EXTRA2 }))).toBeNull();
  });

  it("still rejects origins not in ALLOWED_ORIGINS", () => {
    process.env.ALLOWED_ORIGINS = EXTRA;
    expect(
      checkCsrfOrigin(makeReq("POST", { origin: "https://other.example.com" }))
    ).not.toBeNull();
  });

  it("ignores malformed entries in ALLOWED_ORIGINS without throwing", () => {
    process.env.ALLOWED_ORIGINS = "not-a-url," + EXTRA;
    expect(checkCsrfOrigin(makeReq("POST", { origin: EXTRA }))).toBeNull();
  });
});

describe("checkCsrfOrigin — NEXT_PUBLIC_APP_URL configuration", () => {
  const APP_URL = "https://devtrack.app";

  beforeEach(() => {
    process.env.NEXTAUTH_URL = TRUSTED;
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });
  afterEach(() => {
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("trusts the NEXT_PUBLIC_APP_URL origin", () =>
    expect(
      checkCsrfOrigin(makeReq("POST", { origin: APP_URL }))
    ).toBeNull());

  it("still rejects an unrelated origin", () =>
    expect(
      checkCsrfOrigin(makeReq("POST", { origin: UNTRUSTED }))
    ).not.toBeNull());
});

describe("checkCsrfOrigin — webhook and cron routes (integration — must not be blocked)", () => {
  // These routes are handled by isCsrfExemptPath in the middleware, but
  // the checkCsrfOrigin function itself also exempts Bearer token callers.
  // This block documents the end-to-end expectation.

  it("would allow a GitHub webhook POST (no headers — server to server)", () =>
    expect(checkCsrfOrigin(makeReq("POST"))).toBeNull());

  it("would allow a cron GET (GET is never a mutation)", () =>
    expect(checkCsrfOrigin(makeReq("GET"))).toBeNull());

  it("would allow a local-coding sync POST (Bearer API-key)", () =>
    expect(
      checkCsrfOrigin(makeReq("POST", { authorization: "Bearer lc-key-abc" }))
    ).toBeNull());
});

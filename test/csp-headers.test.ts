import { describe, it, expect } from "vitest";
import { buildCsp } from "@/lib/csp";

const SAMPLE_NONCE = "dGVzdC1ub25jZQ=="; // base64("test-nonce")

describe("buildCsp", () => {
  it("returns a non-empty string", () => {
    expect(buildCsp(SAMPLE_NONCE)).toBeTruthy();
  });

  it("embeds the nonce in script-src", () => {
    const csp = buildCsp(SAMPLE_NONCE);
    expect(csp).toContain(`'nonce-${SAMPLE_NONCE}'`);
  });

  it("includes strict-dynamic for Next.js chunk trust propagation", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("'strict-dynamic'");
  });

  it("blocks all plugins via object-src none", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("object-src 'none'");
  });

  it("disables iframes via frame-src none", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("frame-src 'none'");
  });

  it("disables embedding via frame-ancestors none", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("frame-ancestors 'none'");
  });

  it("restricts base-uri to self", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("base-uri 'self'");
  });

  it("restricts form-action to self", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("form-action 'self'");
  });

  it("allows Supabase client connections", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("https://*.supabase.co");
  });

  it("allows GitHub avatar images", () => {
    const csp = buildCsp(SAMPLE_NONCE);
    expect(csp).toContain("https://avatars.githubusercontent.com");
  });

  it("allows GitHub asset images", () => {
    const csp = buildCsp(SAMPLE_NONCE);
    expect(csp).toContain("https://github.githubassets.com");
  });

  it("allows Vercel Speed Insights telemetry", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain(
      "https://vitals.vercel-insights.com"
    );
  });

  it("allows Vercel Analytics script origin", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("https://va.vercel-scripts.com");
  });

  it("allows PWA service worker via worker-src", () => {
    const csp = buildCsp(SAMPLE_NONCE);
    expect(csp).toContain("worker-src 'self' blob:");
  });

  it("allows PWA manifest via manifest-src", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("manifest-src 'self'");
  });

  it("includes upgrade-insecure-requests", () => {
    expect(buildCsp(SAMPLE_NONCE)).toContain("upgrade-insecure-requests");
  });

  it("uses semicolons as directive separators", () => {
    // Every directive except the last is followed by '; '
    const csp = buildCsp(SAMPLE_NONCE);
    expect(csp.split("; ").length).toBeGreaterThan(5);
  });

  it("does not allow data: URIs in script-src", () => {
    const csp = buildCsp(SAMPLE_NONCE);
    const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("data:");
  });

  it("produces a different CSP for different nonces", () => {
    const csp1 = buildCsp("nonce-one");
    const csp2 = buildCsp("nonce-two");
    expect(csp1).not.toBe(csp2);
  });

  it("does not allow wildcard origins in connect-src", () => {
    const csp = buildCsp(SAMPLE_NONCE);
    const connectSrc = csp
      .split(";")
      .find((d) => d.trim().startsWith("connect-src"));
    // Only *.supabase.co wildcard is intentional and scoped to a single TLD
    const wildcards = (connectSrc?.match(/\*\./g) ?? []).length;
    expect(wildcards).toBeLessThanOrEqual(1);
  });
});

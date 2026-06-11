/**
 * Content Security Policy builder.
 *
 * Kept in its own file so it can be unit-tested independently of the
 * middleware's server-only imports (next-auth, next/server, etc.).
 *
 * Policy rationale — see inline comments on each directive:
 *
 *  default-src 'self'
 *    Baseline: only same-origin resources are allowed unless overridden.
 *
 *  script-src 'nonce-{N}' 'strict-dynamic' 'unsafe-inline' https:
 *    'nonce-{N}'      — guards the one inline theme-init <script> in layout.tsx
 *    'strict-dynamic' — propagates trust from nonce'd scripts to scripts they load
 *                       dynamically (Next.js chunk loader, dynamic imports)
 *    'unsafe-inline'  — CSP Level 2 fallback; ignored by browsers that honour nonces
 *    https:           — CSP Level 2 fallback; ignored by browsers honouring strict-dynamic
 *
 *  style-src 'self' 'unsafe-inline'
 *    'unsafe-inline' is required for:
 *      • CSS animation <style dangerouslySetInnerHTML> in LandingPage.tsx
 *      • DOMPurify-rendered HTML in AIMentorWidget.tsx
 *    CSS injection cannot execute scripts so the risk is substantially lower than
 *    'unsafe-inline' in script-src.
 *
 *  img-src 'self' data: https://avatars.githubusercontent.com https://github.githubassets.com
 *    GitHub avatar CDN and asset CDN match next.config.mjs remotePatterns.
 *    data: covers base64-encoded SVG/PNG used by some chart libraries.
 *
 *  font-src 'self' data:
 *    next/font/google downloads fonts at BUILD TIME and self-hosts them from
 *    /_next/static/ — no runtime requests to fonts.googleapis.com are made.
 *    data: covers rare inline font-face declarations.
 *
 *  connect-src 'self' https://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com
 *    'self'                         — all /api/* routes and the SSE /api/stream endpoint
 *    https://*.supabase.co          — Supabase JS client auth + database + storage calls
 *    https://vitals.vercel-insights.com — Vercel Speed Insights telemetry beacon
 *    https://va.vercel-scripts.com  — Vercel Analytics script fetch (also loaded as script-src)
 *    Note: server-side fetches (GitHub API, Groq, Resend, Discord, WakaTime, Upstash)
 *    are NOT browser requests and therefore do not need CSP allowance.
 *
 *  worker-src 'self' blob:
 *    'self' — PWA service worker registered from /sw.js
 *    blob:  — Workbox may generate blob: worker shims in some environments
 *
 *  frame-src / frame-ancestors 'none'
 *    Fully disables iframes both outbound and inbound (clickjacking prevention).
 *
 *  object-src 'none'    — blocks Flash and other legacy plugin vectors
 *  base-uri 'self'      — prevents <base href="https://evil.com"> hijacking
 *  form-action 'self'   — NextAuth form POSTs stay on the same origin
 *  manifest-src 'self'  — PWA web-app manifest
 *  upgrade-insecure-requests — silently upgrades any stray http:// sub-resources
 */
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://avatars.githubusercontent.com https://github.githubassets.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

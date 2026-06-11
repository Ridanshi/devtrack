import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: false,
  skipWaiting: true,
  fallbacks: {
    document: "/offline.html",
  },
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.github\.com\/.*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "github-api-cache",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location.origin) return false;
        return (
          url.pathname === "/api/dashboard" ||
          url.pathname === "/api/goals" ||
          url.pathname.startsWith("/api/metrics/") ||
          url.pathname.startsWith("/api/streak/")
        );
      },
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "dashboard-api-cache",
        networkTimeoutSeconds: 5,
        cacheableResponse: {
          statuses: [200],
        },
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        return (
          url.origin === self.location.origin &&
          url.pathname === "/api/goals/sync"
        );
      },
      handler: "NetworkOnly",
      method: "POST",
      options: {
        backgroundSync: {
          name: "devtrack-goal-sync-queue",
          options: {
            maxRetentionTime: 24 * 60, // 24 hours
          },
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location.origin) return false;
        if (url.pathname.startsWith("/api/auth/")) return false;
        if (url.pathname.startsWith("/api/webhooks/")) return false;
        // Leaderboard is slow (GitHub + Supabase); let it bypass the SW so the
        // 5-second networkTimeout doesn't race against it and produce unhandled
        // "Failed to fetch" rejections when the cache is empty.
        if (url.pathname.startsWith("/api/leaderboard")) return false;
        return url.pathname.startsWith("/api/");
      },
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 5,
        cacheableResponse: {
          statuses: [200],
        },
        expiration: {
          maxEntries: 80,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "font-assets-cache",
        cacheableResponse: {
          statuses: [0, 200],
        },
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      urlPattern: ({ url }) => {
        if (url.origin !== self.location.origin) return false;
        return (
          url.pathname.startsWith("/_next/static/") ||
          /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp|json)$/.test(
            url.pathname,
          )
        );
      },
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets-cache",
        cacheableResponse: {
          statuses: [200],
        },
        expiration: {
          maxEntries: 160,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
  ],
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "github.githubassets.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          // NOTE: Content-Security-Policy is intentionally omitted here.
          // The middleware (src/middleware.ts) sets a per-request nonce-based CSP
          // header dynamically. Adding a static CSP here would cause browsers to
          // enforce both policies simultaneously (most-restrictive intersection),
          // which would break the nonce scheme on all matched routes.
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);

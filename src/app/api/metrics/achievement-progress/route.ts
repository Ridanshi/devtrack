import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveAppUser } from "@/lib/resolve-user";
import { getCachedGitHubAchievements } from "@/lib/github-achievements";
import { buildLockedAchievementProgress } from "@/lib/achievement-progress";
import { isMetricsCacheBypassed, withMetricsCache } from "@/lib/metrics-cache";

export const dynamic = "force-dynamic";

// Fetches all-time merged-PR count and all-time accepted-discussion-answer
// count for the authenticated viewer in a single round-trip.
const ACHIEVEMENT_PROGRESS_QUERY = `
  query DevTrackAchievementProgress {
    viewer {
      pullRequests(states: [MERGED]) {
        totalCount
      }
      repositoryDiscussionComments(onlyAnswers: true) {
        totalCount
      }
    }
  }
`;

interface AchievementProgressGQLResponse {
  data?: {
    viewer?: {
      pullRequests?: { totalCount: number };
      repositoryDiscussionComments?: { totalCount: number };
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken || !session.githubId || !session.githubLogin) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.error === "TokenRevoked") {
    return Response.json({ error: "token_expired" }, { status: 401 });
  }

  const user = await resolveAppUser(session.githubId, session.githubLogin);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bypass = isMetricsCacheBypassed(req);
  // Build the cache key directly — avoids coupling this endpoint to the
  // METRICS_CACHE_TTL_SECONDS const which only maps already-known endpoints.
  const cacheKey = `metrics:${user.id}:achievement-progress:default`;
  const TTL_SECONDS = 10 * 60; // 10 minutes

  try {
    const result = await withMetricsCache(
      { bypass, key: cacheKey, ttlSeconds: TTL_SECONDS },
      async () => {
        let mergedPrCount: number | null = null;
        let acceptedAnswers: number | null = null;
        let tokenRevoked = false;

        try {
          const gqlRes = await fetch("https://api.github.com/graphql", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.accessToken!}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: ACHIEVEMENT_PROGRESS_QUERY }),
            cache: "no-store",
          });

          if (gqlRes.status === 401) {
            tokenRevoked = true;
          } else if (gqlRes.ok) {
            const gqlData = (await gqlRes.json()) as AchievementProgressGQLResponse;
            const viewer = gqlData.data?.viewer;
            if (typeof viewer?.pullRequests?.totalCount === "number") {
              mergedPrCount = viewer.pullRequests.totalCount;
            }
            if (typeof viewer?.repositoryDiscussionComments?.totalCount === "number") {
              acceptedAnswers = viewer.repositoryDiscussionComments.totalCount;
            }
          }
          // Non-200/non-401 responses (rate limit, 5xx) leave counts as null
          // so affected achievements report "Progress unavailable".
        } catch (err) {
          // Transient network error — counts remain null.
          console.warn("[achievement-progress] GitHub GraphQL fetch failed:", err);
        }

        if (tokenRevoked) {
          // Surface as a sentinel so the outer handler can return 401.
          throw Object.assign(new Error("token_expired"), { code: "TOKEN_REVOKED" });
        }

        // Determine which achievements the user has already unlocked so we
        // only surface progress for locked ones.
        const cached = await getCachedGitHubAchievements(user.id);
        const unlockedSlugs = new Set(
          (cached?.achievements ?? []).map((a) => a.slug)
        );

        const progress = buildLockedAchievementProgress(
          unlockedSlugs,
          mergedPrCount,
          acceptedAnswers
        );

        return { progress };
      }
    );

    return Response.json(result);
  } catch (err) {
    if (
      err instanceof Error &&
      (err as Error & { code?: string }).code === "TOKEN_REVOKED"
    ) {
      return Response.json({ error: "token_expired" }, { status: 401 });
    }
    console.error("[achievement-progress] handler failed:", err);
    return Response.json(
      { error: "Failed to load achievement progress" },
      { status: 502 }
    );
  }
}

/**
 * Achievement progress estimation for locked GitHub achievements.
 *
 * Only achievements for which real contribution data is available as a
 * reliable proxy are given numeric estimates. All others surface
 * "Progress unavailable" explicitly rather than showing a fabricated number.
 *
 * Supported (real data available):
 *   pull-shark          — all-time merged pull-request count (GitHub GraphQL)
 *   galaxy-brain        — all-time accepted discussion-answer count (GitHub GraphQL)
 *
 * Not supported (no reliable proxy in the current data stack):
 *   quickdraw           — requires real-time issue/PR close timing
 *   pair-extraordinaire — requires co-authored-commit query not in current stack
 *   starstruck          — per-repository stargazer counts need separate queries
 *   yolo                — single historical event; cannot be estimated
 *   arctic-code-vault-contributor — no longer earnable
 */

export interface AchievementMilestone {
  /** Numeric threshold for this tier. */
  value: number;
  /** Human-readable tier label, e.g. "Bronze", "Silver", "Gold". */
  label: string;
}

export interface AchievementProgressInfo {
  slug: string;
  title: string;
  description: string;
  /**
   * Percentage toward the next milestone (0–100).
   * Only meaningful when `dataAvailable` is true.
   */
  estimatedProgress: number;
  /** Current measured value (e.g. merged-PR count). */
  currentValue: number;
  /** Next unmet milestone, or null when all tiers have been reached. */
  nextMilestone: AchievementMilestone | null;
  /**
   * Human-readable progress sentence, e.g.
   * "3 / 16 merged PRs — Silver tier"
   */
  progressDescription: string;
  /**
   * When false, the progress fields are placeholders and the UI must display
   * "Progress unavailable" rather than the numeric bar.
   */
  dataAvailable: boolean;
}

// Official GitHub achievement milestone thresholds, in ascending order.
export const PULL_SHARK_MILESTONES = [2, 16, 128] as const;
export const GALAXY_BRAIN_MILESTONES = [2, 8, 16] as const;

const TIER_LABELS = ["Bronze", "Silver", "Gold"] as const;

/**
 * Core milestone math.
 *
 * Given a current count and an ordered list of milestone thresholds,
 * returns how far through the next tier the user is (0–100 %) and
 * what that tier is.  Returns 100 % with nextMilestone = null once all
 * tiers have been surpassed.
 */
export function computeMilestoneProgress(
  current: number,
  milestones: readonly number[]
): {
  estimatedProgress: number;
  nextMilestone: AchievementMilestone | null;
} {
  if (milestones.length === 0) {
    return { estimatedProgress: 0, nextMilestone: null };
  }

  const nextIdx = milestones.findIndex((m) => current < m);

  if (nextIdx === -1) {
    // All tiers already cleared.
    return { estimatedProgress: 100, nextMilestone: null };
  }

  const next = milestones[nextIdx];
  const prev = nextIdx === 0 ? 0 : milestones[nextIdx - 1];
  const range = next - prev;
  const progress =
    range === 0
      ? 100
      : Math.min(100, Math.floor(((current - prev) / range) * 100));

  return {
    estimatedProgress: Math.max(0, progress),
    nextMilestone: {
      value: next,
      label: TIER_LABELS[nextIdx] ?? `Level ${nextIdx + 1}`,
    },
  };
}

// ─── per-achievement estimators ──────────────────────────────────────────────

export function estimatePullSharkProgress(mergedPrCount: number): AchievementProgressInfo {
  const { estimatedProgress, nextMilestone } = computeMilestoneProgress(
    mergedPrCount,
    PULL_SHARK_MILESTONES
  );

  const progressDescription = nextMilestone
    ? `${mergedPrCount} / ${nextMilestone.value} merged PRs — ${nextMilestone.label} tier`
    : `${mergedPrCount} merged PRs — all tiers reached`;

  return {
    slug: "pull-shark",
    title: "Pull Shark",
    description: "Opened pull requests that were merged.",
    estimatedProgress,
    currentValue: mergedPrCount,
    nextMilestone,
    progressDescription,
    dataAvailable: true,
  };
}

export function estimateGalaxyBrainProgress(acceptedAnswers: number): AchievementProgressInfo {
  const { estimatedProgress, nextMilestone } = computeMilestoneProgress(
    acceptedAnswers,
    GALAXY_BRAIN_MILESTONES
  );

  const progressDescription = nextMilestone
    ? `${acceptedAnswers} / ${nextMilestone.value} accepted answers — ${nextMilestone.label} tier`
    : `${acceptedAnswers} accepted answers — all tiers reached`;

  return {
    slug: "galaxy-brain",
    title: "Galaxy Brain",
    description: "Answered discussions with replies marked as accepted.",
    estimatedProgress,
    currentValue: acceptedAnswers,
    nextMilestone,
    progressDescription,
    dataAvailable: true,
  };
}

function unavailableProgress(
  slug: string,
  title: string,
  description: string
): AchievementProgressInfo {
  return {
    slug,
    title,
    description,
    estimatedProgress: 0,
    currentValue: 0,
    nextMilestone: null,
    progressDescription: "Progress unavailable",
    dataAvailable: false,
  };
}

export function getQuickdrawProgress(): AchievementProgressInfo {
  return unavailableProgress(
    "quickdraw",
    "Quickdraw",
    "Closed an issue or pull request shortly after opening it."
  );
}

export function getPairExtraordinaireProgress(): AchievementProgressInfo {
  return unavailableProgress(
    "pair-extraordinaire",
    "Pair Extraordinaire",
    "Coauthored commits that were merged into a repository."
  );
}

// ─── aggregate builder ────────────────────────────────────────────────────────

/**
 * Build progress objects for all trackable achievements that are not yet
 * unlocked by the user.
 *
 * @param unlockedSlugs  Set of achievement slugs the user has already earned.
 * @param mergedPrCount  Total merged PR count from GitHub, or null if unavailable.
 * @param acceptedAnswers Total accepted-discussion-answer count, or null if unavailable.
 */
export function buildLockedAchievementProgress(
  unlockedSlugs: Set<string>,
  mergedPrCount: number | null,
  acceptedAnswers: number | null
): AchievementProgressInfo[] {
  const result: AchievementProgressInfo[] = [];

  if (!unlockedSlugs.has("pull-shark")) {
    result.push(
      mergedPrCount !== null
        ? estimatePullSharkProgress(mergedPrCount)
        : unavailableProgress(
            "pull-shark",
            "Pull Shark",
            "Opened pull requests that were merged."
          )
    );
  }

  if (!unlockedSlugs.has("galaxy-brain")) {
    result.push(
      acceptedAnswers !== null
        ? estimateGalaxyBrainProgress(acceptedAnswers)
        : unavailableProgress(
            "galaxy-brain",
            "Galaxy Brain",
            "Answered discussions with replies marked as accepted."
          )
    );
  }

  if (!unlockedSlugs.has("quickdraw")) {
    result.push(getQuickdrawProgress());
  }

  if (!unlockedSlugs.has("pair-extraordinaire")) {
    result.push(getPairExtraordinaireProgress());
  }

  return result;
}

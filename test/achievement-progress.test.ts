/**
 * Tests for the GitHub achievement progress estimator.
 *
 * Covers:
 *   - Core milestone math (computeMilestoneProgress)
 *   - Pull Shark progress estimation
 *   - Galaxy Brain progress estimation
 *   - Quickdraw unavailability
 *   - Pair Extraordinaire unavailability
 *   - buildLockedAchievementProgress — locked vs. unlocked filtering
 *   - Mixed batches (some data available, some not)
 *   - Boundary values and all-milestones-cleared cases
 *   - next milestone and progressDescription correctness
 */

import { describe, it, expect } from "vitest";
import {
  computeMilestoneProgress,
  estimatePullSharkProgress,
  estimateGalaxyBrainProgress,
  getQuickdrawProgress,
  getPairExtraordinaireProgress,
  buildLockedAchievementProgress,
  PULL_SHARK_MILESTONES,
  GALAXY_BRAIN_MILESTONES,
} from "../src/lib/achievement-progress";

// ─── computeMilestoneProgress ─────────────────────────────────────────────────

describe("computeMilestoneProgress", () => {
  it("returns 0% progress and the first milestone when current is 0", () => {
    const { estimatedProgress, nextMilestone } = computeMilestoneProgress(0, [2, 16, 128]);
    expect(estimatedProgress).toBe(0);
    expect(nextMilestone?.value).toBe(2);
    expect(nextMilestone?.label).toBe("Bronze");
  });

  it("returns 50% when halfway to the first milestone", () => {
    // Milestones: [2, 16, 128]. Range 0→2. At 1 → 50%.
    const { estimatedProgress } = computeMilestoneProgress(1, [2, 16, 128]);
    expect(estimatedProgress).toBe(50);
  });

  it("progresses to the Silver tier once the Bronze threshold is met", () => {
    // current = 2 → Bronze cleared, heading for Silver at 16.
    const { estimatedProgress, nextMilestone } = computeMilestoneProgress(2, [2, 16, 128]);
    expect(estimatedProgress).toBe(0);          // 0% through the 2→16 range
    expect(nextMilestone?.value).toBe(16);
    expect(nextMilestone?.label).toBe("Silver");
  });

  it("calculates Silver-tier progress correctly (mid-range)", () => {
    // Range 2→16 = 14 wide. At 9: (9-2)/14 ≈ 50%.
    const { estimatedProgress, nextMilestone } = computeMilestoneProgress(9, [2, 16, 128]);
    expect(estimatedProgress).toBe(50);
    expect(nextMilestone?.value).toBe(16);
  });

  it("returns 100% and null nextMilestone when all milestones are cleared", () => {
    const { estimatedProgress, nextMilestone } = computeMilestoneProgress(200, [2, 16, 128]);
    expect(estimatedProgress).toBe(100);
    expect(nextMilestone).toBeNull();
  });

  it("exactly at the last milestone returns 100% with null nextMilestone", () => {
    const { estimatedProgress, nextMilestone } = computeMilestoneProgress(128, [2, 16, 128]);
    expect(estimatedProgress).toBe(100);
    expect(nextMilestone).toBeNull();
  });

  it("handles empty milestones array gracefully", () => {
    const { estimatedProgress, nextMilestone } = computeMilestoneProgress(5, []);
    expect(estimatedProgress).toBe(0);
    expect(nextMilestone).toBeNull();
  });

  it("never returns progress below 0", () => {
    const { estimatedProgress } = computeMilestoneProgress(-5, [2, 16, 128]);
    expect(estimatedProgress).toBeGreaterThanOrEqual(0);
  });

  it("never returns progress above 100", () => {
    const { estimatedProgress } = computeMilestoneProgress(999, [2, 16, 128]);
    expect(estimatedProgress).toBeLessThanOrEqual(100);
  });

  it("uses the PULL_SHARK_MILESTONES constant correctly", () => {
    // Verify the exported constant is used and has expected values.
    expect(PULL_SHARK_MILESTONES).toEqual([2, 16, 128]);
  });

  it("uses the GALAXY_BRAIN_MILESTONES constant correctly", () => {
    expect(GALAXY_BRAIN_MILESTONES).toEqual([2, 8, 16]);
  });
});

// ─── estimatePullSharkProgress ────────────────────────────────────────────────

describe("estimatePullSharkProgress", () => {
  it("returns dataAvailable: true", () => {
    expect(estimatePullSharkProgress(0).dataAvailable).toBe(true);
  });

  it("has slug 'pull-shark'", () => {
    expect(estimatePullSharkProgress(5).slug).toBe("pull-shark");
  });

  it("reflects currentValue accurately", () => {
    expect(estimatePullSharkProgress(7).currentValue).toBe(7);
  });

  it("targets Bronze (2) when merged PRs are 0", () => {
    const result = estimatePullSharkProgress(0);
    expect(result.nextMilestone?.value).toBe(2);
    expect(result.nextMilestone?.label).toBe("Bronze");
    expect(result.estimatedProgress).toBe(0);
  });

  it("targets Silver (16) when merged PRs = 2 (Bronze cleared)", () => {
    const result = estimatePullSharkProgress(2);
    expect(result.nextMilestone?.value).toBe(16);
    expect(result.nextMilestone?.label).toBe("Silver");
  });

  it("targets Gold (128) when merged PRs = 16 (Silver cleared)", () => {
    const result = estimatePullSharkProgress(16);
    expect(result.nextMilestone?.value).toBe(128);
    expect(result.nextMilestone?.label).toBe("Gold");
  });

  it("has null nextMilestone when all tiers are cleared", () => {
    const result = estimatePullSharkProgress(200);
    expect(result.nextMilestone).toBeNull();
    expect(result.estimatedProgress).toBe(100);
  });

  it("includes merge count and tier label in progressDescription", () => {
    const result = estimatePullSharkProgress(5);
    expect(result.progressDescription).toContain("5");
    expect(result.progressDescription.toLowerCase()).toMatch(/silver|bronze|gold/);
  });

  it("progressDescription notes all tiers reached when count >= 128", () => {
    const result = estimatePullSharkProgress(128);
    expect(result.progressDescription).toMatch(/all tiers/i);
  });
});

// ─── estimateGalaxyBrainProgress ─────────────────────────────────────────────

describe("estimateGalaxyBrainProgress", () => {
  it("returns dataAvailable: true", () => {
    expect(estimateGalaxyBrainProgress(0).dataAvailable).toBe(true);
  });

  it("has slug 'galaxy-brain'", () => {
    expect(estimateGalaxyBrainProgress(1).slug).toBe("galaxy-brain");
  });

  it("reflects currentValue accurately", () => {
    expect(estimateGalaxyBrainProgress(3).currentValue).toBe(3);
  });

  it("targets Bronze (2) when accepted answers are 0", () => {
    const result = estimateGalaxyBrainProgress(0);
    expect(result.nextMilestone?.value).toBe(2);
    expect(result.nextMilestone?.label).toBe("Bronze");
    expect(result.estimatedProgress).toBe(0);
  });

  it("targets Silver (8) when accepted answers = 2 (Bronze cleared)", () => {
    const result = estimateGalaxyBrainProgress(2);
    expect(result.nextMilestone?.value).toBe(8);
    expect(result.nextMilestone?.label).toBe("Silver");
  });

  it("targets Gold (16) when accepted answers = 8 (Silver cleared)", () => {
    const result = estimateGalaxyBrainProgress(8);
    expect(result.nextMilestone?.value).toBe(16);
    expect(result.nextMilestone?.label).toBe("Gold");
  });

  it("has null nextMilestone and 100% when all tiers are cleared (>= 16)", () => {
    const result = estimateGalaxyBrainProgress(20);
    expect(result.nextMilestone).toBeNull();
    expect(result.estimatedProgress).toBe(100);
  });

  it("includes answer count and tier label in progressDescription", () => {
    const result = estimateGalaxyBrainProgress(3);
    expect(result.progressDescription).toContain("3");
    expect(result.progressDescription.toLowerCase()).toMatch(/silver|bronze|gold/);
  });
});

// ─── getQuickdrawProgress ─────────────────────────────────────────────────────

describe("getQuickdrawProgress", () => {
  it("has slug 'quickdraw'", () => {
    expect(getQuickdrawProgress().slug).toBe("quickdraw");
  });

  it("returns dataAvailable: false", () => {
    expect(getQuickdrawProgress().dataAvailable).toBe(false);
  });

  it("reports 'Progress unavailable' in progressDescription", () => {
    expect(getQuickdrawProgress().progressDescription).toMatch(/unavailable/i);
  });

  it("has null nextMilestone", () => {
    expect(getQuickdrawProgress().nextMilestone).toBeNull();
  });
});

// ─── getPairExtraordinaireProgress ───────────────────────────────────────────

describe("getPairExtraordinaireProgress", () => {
  it("has slug 'pair-extraordinaire'", () => {
    expect(getPairExtraordinaireProgress().slug).toBe("pair-extraordinaire");
  });

  it("returns dataAvailable: false", () => {
    expect(getPairExtraordinaireProgress().dataAvailable).toBe(false);
  });

  it("reports 'Progress unavailable' in progressDescription", () => {
    expect(getPairExtraordinaireProgress().progressDescription).toMatch(/unavailable/i);
  });
});

// ─── buildLockedAchievementProgress ──────────────────────────────────────────

describe("buildLockedAchievementProgress", () => {
  it("returns progress for all four tracked achievements when none are unlocked", () => {
    const result = buildLockedAchievementProgress(new Set(), 5, 1);
    const slugs = result.map((r) => r.slug);
    expect(slugs).toContain("pull-shark");
    expect(slugs).toContain("galaxy-brain");
    expect(slugs).toContain("quickdraw");
    expect(slugs).toContain("pair-extraordinaire");
  });

  it("omits pull-shark when it is already unlocked", () => {
    const unlocked = new Set(["pull-shark"]);
    const result = buildLockedAchievementProgress(unlocked, 20, 0);
    expect(result.map((r) => r.slug)).not.toContain("pull-shark");
  });

  it("omits galaxy-brain when it is already unlocked", () => {
    const unlocked = new Set(["galaxy-brain"]);
    const result = buildLockedAchievementProgress(unlocked, 0, 5);
    expect(result.map((r) => r.slug)).not.toContain("galaxy-brain");
  });

  it("omits quickdraw when it is already unlocked", () => {
    const unlocked = new Set(["quickdraw"]);
    const result = buildLockedAchievementProgress(unlocked, 0, 0);
    expect(result.map((r) => r.slug)).not.toContain("quickdraw");
  });

  it("omits pair-extraordinaire when it is already unlocked", () => {
    const unlocked = new Set(["pair-extraordinaire"]);
    const result = buildLockedAchievementProgress(unlocked, 0, 0);
    expect(result.map((r) => r.slug)).not.toContain("pair-extraordinaire");
  });

  it("returns empty array when all four tracked achievements are unlocked", () => {
    const unlocked = new Set([
      "pull-shark",
      "galaxy-brain",
      "quickdraw",
      "pair-extraordinaire",
    ]);
    expect(buildLockedAchievementProgress(unlocked, 99, 99)).toHaveLength(0);
  });

  it("uses actual data when mergedPrCount is provided", () => {
    const result = buildLockedAchievementProgress(new Set(), 8, null);
    const ps = result.find((r) => r.slug === "pull-shark");
    expect(ps?.dataAvailable).toBe(true);
    expect(ps?.currentValue).toBe(8);
  });

  it("marks pull-shark as unavailable when mergedPrCount is null", () => {
    const result = buildLockedAchievementProgress(new Set(), null, null);
    const ps = result.find((r) => r.slug === "pull-shark");
    expect(ps?.dataAvailable).toBe(false);
    expect(ps?.progressDescription).toMatch(/unavailable/i);
  });

  it("uses actual data when acceptedAnswers is provided", () => {
    const result = buildLockedAchievementProgress(new Set(), null, 4);
    const gb = result.find((r) => r.slug === "galaxy-brain");
    expect(gb?.dataAvailable).toBe(true);
    expect(gb?.currentValue).toBe(4);
  });

  it("marks galaxy-brain as unavailable when acceptedAnswers is null", () => {
    const result = buildLockedAchievementProgress(new Set(), null, null);
    const gb = result.find((r) => r.slug === "galaxy-brain");
    expect(gb?.dataAvailable).toBe(false);
  });

  it("handles mixed data — some available, some not", () => {
    const result = buildLockedAchievementProgress(new Set(), 10, null);
    const ps = result.find((r) => r.slug === "pull-shark");
    const gb = result.find((r) => r.slug === "galaxy-brain");
    expect(ps?.dataAvailable).toBe(true);
    expect(gb?.dataAvailable).toBe(false);
  });

  it("sentCount accuracy — pull-shark estimatedProgress is 0 when merged = 0", () => {
    const result = buildLockedAchievementProgress(new Set(), 0, 0);
    const ps = result.find((r) => r.slug === "pull-shark");
    expect(ps?.estimatedProgress).toBe(0);
  });

  it("sentCount accuracy — pull-shark estimatedProgress is 100 once all tiers cleared", () => {
    const result = buildLockedAchievementProgress(new Set(), 200, 0);
    const ps = result.find((r) => r.slug === "pull-shark");
    expect(ps?.estimatedProgress).toBe(100);
  });
});

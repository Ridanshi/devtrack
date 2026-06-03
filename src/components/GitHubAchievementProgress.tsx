"use client";

import { useCallback, useEffect, useState } from "react";
import type { AchievementProgressInfo } from "@/lib/achievement-progress";

interface AchievementProgressResponse {
  progress: AchievementProgressInfo[];
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${value}% complete`}
      className="h-2 w-full overflow-hidden rounded-full bg-[var(--border)]"
    >
      <div
        className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function AchievementCard({ item }: { item: AchievementProgressInfo }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--control)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--card-foreground)] truncate">
            {item.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)] line-clamp-2">
            {item.description}
          </p>
        </div>
        {item.dataAvailable && item.nextMilestone && (
          <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {item.nextMilestone.label}
          </span>
        )}
      </div>

      {item.dataAvailable ? (
        <>
          <ProgressBar value={item.estimatedProgress} />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              {item.progressDescription}
            </p>
            <span className="shrink-0 text-xs font-semibold text-[var(--accent)]">
              {item.estimatedProgress}%
            </span>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)] italic">
            Estimated progress
          </p>
        </>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">
          Progress unavailable
        </p>
      )}
    </div>
  );
}

export default function GitHubAchievementProgress() {
  const [items, setItems] = useState<AchievementProgressInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/metrics/achievement-progress")
      .then(async (res) => {
        if (!res.ok) throw new Error("API error");
        return res.json() as Promise<AchievementProgressResponse>;
      })
      .then((data) => setItems(data.progress ?? []))
      .catch(() =>
        setError(
          "We couldn't load achievement progress right now. Please try again in a moment."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
            Achievement Progress
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Estimated progress toward locked GitHub achievements
          </p>
        </div>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <span className="sr-only">Loading achievement progress</span>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="h-28 rounded-lg skeleton-shimmer"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[var(--destructive)]/20 bg-[var(--destructive)]/10 p-4 text-sm text-[var(--destructive)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={fetchProgress}
            className="mt-3 rounded-md border border-[var(--destructive)]/30 px-3 py-1.5 text-xs font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          >
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          All tracked achievements have been unlocked — check your GitHub profile for the full list.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <AchievementCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

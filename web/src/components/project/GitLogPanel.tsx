"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitCommit as GitCommitIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { GitCommit } from "@/types";

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface GitLogPanelProps {
  clusterId: string;
  onViewDiff: (sha: string) => void;
}

const PAGE_SIZE = 50;

export function GitLogPanel({ clusterId, onViewDiff }: GitLogPanelProps) {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const { isLoading } = useQuery({
    queryKey: ["sandbox-log", clusterId, offset],
    queryFn: async () => {
      const page = await api.sandbox.log(clusterId, PAGE_SIZE, offset);
      setCommits((prev) => (offset === 0 ? page : [...prev, ...page]));
      if (page.length < PAGE_SIZE) setHasMore(false);
      return page;
    },
  });

  const loadMore = () => {
    setOffset((o) => o + PAGE_SIZE);
  };

  return (
    <div className="flex flex-col" data-testid="git-log-panel">
      <div className="px-3 py-1.5 border-b text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <GitCommitIcon className="h-3.5 w-3.5" />
        COMMIT HISTORY
      </div>
      <div className="overflow-y-auto max-h-[220px]">
        {commits.map((commit) => (
          <div
            key={commit.sha}
            className="flex items-center gap-3 px-3 py-1.5 text-xs border-b border-border/50 hover:bg-accent/50 transition-colors"
          >
            <button
              className="font-mono text-blue-400 hover:underline shrink-0"
              onClick={() => onViewDiff(commit.sha)}
              title="View diff"
            >
              {commit.sha.substring(0, 7)}
            </button>
            <span className="truncate flex-1">{commit.message}</span>
            <span className="text-muted-foreground shrink-0">{commit.author}</span>
            <span className="text-muted-foreground shrink-0 w-16 text-right">
              {relativeDate(commit.date)}
            </span>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && hasMore && commits.length > 0 && (
          <div className="flex justify-center py-2">
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={loadMore}>
              Load more
            </Button>
          </div>
        )}
        {!isLoading && commits.length === 0 && (
          <div className="text-center py-4 text-xs text-muted-foreground">No commits found.</div>
        )}
      </div>
    </div>
  );
}

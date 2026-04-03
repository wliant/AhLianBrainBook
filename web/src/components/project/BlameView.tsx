"use client";

import { useMemo } from "react";
import { GitCommit as GitCommitIcon } from "lucide-react";
import { relativeDate } from "@/lib/utils";
import type { BlameLine } from "@/types";

interface BlameViewProps {
  blameData: BlameLine[];
  selectedPath: string | null;
  onViewDiff?: (sha: string) => void;
}

interface CommitGroup {
  sha: string;
  author: string;
  date: string;
  lineRanges: string;
  lineCount: number;
}

function buildLineRanges(lines: number[]): string {
  if (lines.length === 0) return "";
  const sorted = [...lines].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}–${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}–${end}`);
  return ranges.join(", ");
}

export function BlameView({ blameData, selectedPath, onViewDiff }: BlameViewProps) {
  const groups = useMemo<CommitGroup[]>(() => {
    const map = new Map<string, { author: string; date: string; lines: number[] }>();
    const order: string[] = [];

    for (const bl of blameData) {
      if (!bl.commitSha || !bl.author || !bl.date) continue;
      if (!map.has(bl.commitSha)) {
        map.set(bl.commitSha, { author: bl.author, date: bl.date, lines: [] });
        order.push(bl.commitSha);
      }
      map.get(bl.commitSha)!.lines.push(bl.line);
    }

    return order.map((sha) => {
      const entry = map.get(sha)!;
      return {
        sha,
        author: entry.author,
        date: entry.date,
        lineRanges: buildLineRanges(entry.lines),
        lineCount: entry.lines.length,
      };
    });
  }, [blameData]);

  const fileName = selectedPath ? selectedPath.split("/").pop() : null;

  return (
    <div className="flex flex-col border-t" data-testid="blame-view">
      <div className="px-3 py-1.5 border-b text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <GitCommitIcon className="h-3.5 w-3.5" />
        BLAME{fileName && <span className="text-foreground/60"> — {fileName}</span>}
      </div>
      <div className="overflow-y-auto max-h-[220px]">
        {groups.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">No blame data.</div>
        ) : (
          groups.map((g) => (
            <div
              key={g.sha}
              className="flex items-center gap-3 px-3 py-1.5 text-xs border-b border-border/50 hover:bg-accent/50 transition-colors"
            >
              <button
                className="font-mono text-blue-400 hover:underline shrink-0"
                onClick={() => onViewDiff?.(g.sha)}
                title={onViewDiff ? "View diff" : g.sha}
                disabled={!onViewDiff}
              >
                {g.sha.substring(0, 7)}
              </button>
              <span className="text-muted-foreground shrink-0 max-w-[100px] truncate">{g.author}</span>
              <span className="text-muted-foreground shrink-0 w-14 text-right">{relativeDate(g.date)}</span>
              <span className="text-muted-foreground/60 truncate flex-1 text-right">
                {g.lineCount === 1 ? "line" : "lines"} {g.lineRanges}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

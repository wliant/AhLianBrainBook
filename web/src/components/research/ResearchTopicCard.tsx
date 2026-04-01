"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { BulletTree } from "./BulletTree";
import type { ResearchTopic } from "@/types";

interface ResearchTopicCardProps {
  topic: ResearchTopic;
  brainId: string;
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
  onExpand: (topicId: string, bulletId: string) => void;
  refreshing: boolean;
  expandingBulletId: string | null;
}

export function ResearchTopicCard({
  topic,
  brainId,
  onRefresh,
  onDelete,
  onExpand,
  refreshing,
  expandingBulletId,
}: ResearchTopicCardProps) {
  const [expanded, setExpanded] = useState(false);
  const items = topic.contentJson?.items ?? [];

  return (
    <div className="border rounded-lg" data-testid={`research-topic-${topic.id}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium flex-1">{topic.title}</span>
        <CompletenessIndicator level={topic.overallCompleteness} />
        <button
          onClick={(e) => { e.stopPropagation(); onRefresh(topic.id); }}
          disabled={refreshing}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Refresh scores"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(topic.id); }}
          className="p-1 text-muted-foreground hover:text-destructive"
          title="Delete topic"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t">
          {topic.prompt && (
            <p className="text-xs text-muted-foreground mt-2 mb-2 italic">
              Prompt: {topic.prompt}
            </p>
          )}
          {items.length > 0 ? (
            <BulletTree
              items={items}
              brainId={brainId}
              onExpand={(bulletId) => onExpand(topic.id, bulletId)}
              expandingBulletId={expandingBulletId}
            />
          ) : (
            <p className="text-sm text-muted-foreground py-2">No bullet points generated.</p>
          )}
          {topic.lastRefreshedAt && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Last refreshed: {new Date(topic.lastRefreshedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

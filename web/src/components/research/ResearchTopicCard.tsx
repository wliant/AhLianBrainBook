"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { CompletenessIndicator } from "./CompletenessIndicator";
import { BulletTree } from "./BulletTree";
import type { ResearchTopic } from "@/types";

interface ResearchTopicCardProps {
  topic: ResearchTopic;
  brainId: string;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
  onExpand: (topicId: string, bulletId: string) => void;
}

export function ResearchTopicCard({
  topic,
  brainId,
  onUpdate,
  onDelete,
  onExpand,
}: ResearchTopicCardProps) {
  const [expanded, setExpanded] = useState(false);
  const items = topic.contentJson?.items ?? [];
  const isGenerating = topic.status === "generating";
  const isUpdating = topic.status === "updating";
  const isBusy = isGenerating || isUpdating;

  return (
    <div className="border rounded-lg" data-testid={`research-topic-${topic.id}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => !isGenerating && setExpanded(!expanded)}
      >
        {isGenerating ? (
          <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
        ) : expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className={`font-medium flex-1 ${isGenerating ? "text-muted-foreground" : ""}`}>
          {topic.title}
        </span>
        {isUpdating && (
          <span className="text-[11px] px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 bg-blue-500/20 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating
          </span>
        )}
        {!isBusy && <CompletenessIndicator level={topic.overallCompleteness} />}
        {isGenerating && (
          <span className="text-[11px] px-1.5 py-0.5 rounded text-muted-foreground bg-muted">
            Generating...
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onUpdate(topic.id); }}
          disabled={isBusy}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Update"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isUpdating ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(topic.id); }}
          disabled={isBusy}
          className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
          title="Delete topic"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && !isGenerating && (
        <div className="px-4 pb-3 border-t">
          {items.length > 0 ? (
            <div className="mt-2">
              <BulletTree
                items={items}
                brainId={brainId}
                onExpand={(bulletId) => onExpand(topic.id, bulletId)}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No bullet points generated.</p>
          )}
          {topic.lastRefreshedAt && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Last updated: {new Date(topic.lastRefreshedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

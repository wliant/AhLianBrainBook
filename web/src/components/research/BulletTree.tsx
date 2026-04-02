"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Expand, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { CompletenessIndicator } from "./CompletenessIndicator";
import type { BulletItem } from "@/types";

interface BulletTreeProps {
  items: BulletItem[];
  brainId: string;
  onExpand?: (bulletId: string) => void;
  expandingBulletId?: string | null;
}

export function BulletTree({ items, brainId, onExpand, expandingBulletId }: BulletTreeProps) {
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <BulletNode
          key={item.id}
          item={item}
          brainId={brainId}
          depth={0}
          onExpand={onExpand}
          expandingBulletId={expandingBulletId}
        />
      ))}
    </div>
  );
}

function BulletNode({
  item,
  brainId,
  depth,
  onExpand,
  expandingBulletId,
}: {
  item: BulletItem;
  brainId: string;
  depth: number;
  onExpand?: (bulletId: string) => void;
  expandingBulletId?: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = item.children && item.children.length > 0;
  const isExpanding = expandingBulletId === item.id;

  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      <div className="flex items-start gap-2 py-1 group">
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 p-0.5 text-muted-foreground hover:text-foreground shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="mt-0.5 w-[18px] shrink-0 text-center text-muted-foreground">&#8226;</span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{item.text}</span>
            <CompletenessIndicator level={item.completeness} />
            {onExpand && (
              <button
                onClick={() => onExpand(item.id)}
                disabled={isExpanding}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                title="Expand into sub-points"
              >
                <Expand className="h-3 w-3" />
              </button>
            )}
          </div>
          {item.explanation && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.explanation}</p>
          )}
          {item.linkedNeuronIds && item.linkedNeuronIds.length > 0 && (
            <div className="flex items-center gap-1 mt-0.5">
              <LinkIcon className="h-3 w-3 text-muted-foreground" />
              {item.linkedNeuronIds.map((nid) => (
                <Link
                  key={nid}
                  href={`/brain/${brainId}/cluster/*/neuron/${nid}`}
                  className="text-[11px] text-primary hover:underline"
                >
                  {nid.slice(0, 8)}...
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <BulletTree
          items={item.children}
          brainId={brainId}
          onExpand={onExpand}
          expandingBulletId={expandingBulletId}
        />
      )}
    </div>
  );
}

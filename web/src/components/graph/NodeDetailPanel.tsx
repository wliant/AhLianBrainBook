"use client";

import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NodeDetail {
  id: string;
  title: string;
  clusterId: string;
  clusterName: string;
  contentText: string | null;
  tagNames: string[];
}

export function NodeDetailPanel({
  node,
  brainId,
  onClose,
}: {
  node: NodeDetail;
  brainId: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute right-0 top-0 h-full w-80 border-l bg-background shadow-lg z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm truncate">{node.title}</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Cluster</p>
          <p className="text-sm">{node.clusterName}</p>
        </div>

        {node.contentText && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
            <p className="text-sm text-muted-foreground line-clamp-6">
              {node.contentText.slice(0, 300)}
            </p>
          </div>
        )}

        {node.tagNames.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Tags</p>
            <div className="flex flex-wrap gap-1">
              {node.tagNames.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-4">
        <Link href={`/brain/${brainId}/cluster/${node.clusterId}/neuron/${node.id}`}>
          <Button size="sm" className="w-full gap-2">
            <ExternalLink className="h-3.5 w-3.5" /> Open in Editor
          </Button>
        </Link>
      </div>
    </div>
  );
}

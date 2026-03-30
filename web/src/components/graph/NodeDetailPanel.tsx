"use client";

import Link from "next/link";
import { X, ExternalLink, Focus, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NodeDetail {
  id: string;
  title: string;
  clusterId: string;
  clusterName: string;
  contentText: string | null;
  tagNames: string[];
}

interface Connection {
  direction: "in" | "out";
  neuronId: string;
  neuronTitle: string;
  clusterId: string;
  linkType: string;
  label?: string;
}

export function NodeDetailPanel({
  node,
  brainId,
  connections,
  isFocused,
  onFocus,
  onClose,
}: {
  node: NodeDetail;
  brainId: string;
  connections?: Connection[];
  isFocused?: boolean;
  onFocus?: () => void;
  onClose: () => void;
}) {
  const outgoing = connections?.filter((c) => c.direction === "out") || [];
  const incoming = connections?.filter((c) => c.direction === "in") || [];

  return (
    <div className="absolute right-0 top-0 h-full w-80 border-l bg-background shadow-lg z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm truncate">{node.title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {onFocus && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onFocus}
              title={isFocused ? "Exit Focus" : "Focus on this node"}
            >
              <Focus className={cn("h-4 w-4", isFocused && "text-blue-400")} />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
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

        {connections && connections.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Connections ({connections.length})
            </p>
            {outgoing.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Outgoing ({outgoing.length})
                </p>
                <div className="space-y-1">
                  {outgoing.map((c) => (
                    <Link
                      key={`out-${c.neuronId}`}
                      href={`/brain/${brainId}/cluster/${c.clusterId}/neuron/${c.neuronId}`}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-muted group"
                    >
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate group-hover:text-foreground">{c.neuronTitle}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground shrink-0">
                        {c.linkType}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {incoming.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  Incoming ({incoming.length})
                </p>
                <div className="space-y-1">
                  {incoming.map((c) => (
                    <Link
                      key={`in-${c.neuronId}`}
                      href={`/brain/${brainId}/cluster/${c.clusterId}/neuron/${c.neuronId}`}
                      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-muted group"
                    >
                      <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate group-hover:text-foreground">{c.neuronTitle}</span>
                      <span className="text-[9px] px-1 py-0.5 rounded bg-muted-foreground/10 text-muted-foreground shrink-0">
                        {c.linkType}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
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

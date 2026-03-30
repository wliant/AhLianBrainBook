"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface NeuronNodeData {
  title: string;
  clusterName: string;
  clusterColor: string;
  complexity?: string | null;
  dimmed?: boolean;
  [key: string]: unknown;
}

const COMPLEXITY_STYLES: Record<string, string> = {
  complex: "bg-red-500/20 text-red-400",
  moderate: "bg-yellow-500/20 text-yellow-400",
  simple: "bg-green-500/20 text-green-400",
};

function NeuronNodeComponent({ data, selected }: NodeProps) {
  const { title, clusterName, clusterColor, complexity, dimmed } = data as NeuronNodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div
        className={`rounded-lg border bg-card px-3 py-2 shadow-sm transition-all min-w-[160px] max-w-[220px] ${
          selected ? "ring-2 ring-blue-400 shadow-md" : ""
        } ${dimmed ? "opacity-20" : ""}`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: clusterColor }}
          />
          <span className="text-[10px] text-muted-foreground truncate flex-1">
            {clusterName}
          </span>
          {complexity && (
            <span className={`text-[9px] px-1 py-0.5 rounded ${COMPLEXITY_STYLES[complexity] || ""}`}>
              {complexity}
            </span>
          )}
        </div>
        <p className="text-xs font-medium truncate">{title || "Untitled"}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </>
  );
}

export const NeuronNode = memo(NeuronNodeComponent);

"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface NeuronNodeData {
  title: string;
  clusterName: string;
  clusterColor: string;
  [key: string]: unknown;
}

function NeuronNodeComponent({ data, selected }: NodeProps) {
  const { title, clusterName, clusterColor } = data as NeuronNodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div
        className={`rounded-lg border bg-card px-3 py-2 shadow-sm transition-shadow min-w-[160px] max-w-[220px] ${
          selected ? "ring-2 ring-blue-400 shadow-md" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: clusterColor }}
          />
          <span className="text-[10px] text-muted-foreground truncate">
            {clusterName}
          </span>
        </div>
        <p className="text-xs font-medium truncate">{title || "Untitled"}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </>
  );
}

export const NeuronNode = memo(NeuronNodeComponent);

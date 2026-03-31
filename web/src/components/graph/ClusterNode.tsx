"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

interface ClusterNodeData {
  clusterName: string;
  clusterColor: string;
  neuronCount: number;
  clusterId: string;
  [key: string]: unknown;
}

function ClusterNodeComponent({ data, selected }: NodeProps) {
  const { clusterName, clusterColor, neuronCount } = data as ClusterNodeData;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!w-2 !h-2" />
      <div
        className={`rounded-xl border-2 bg-card px-4 py-3 shadow-md transition-all min-w-[200px] max-w-[260px] cursor-pointer ${
          selected ? "ring-2 ring-blue-400 shadow-lg" : ""
        }`}
        style={{ borderColor: clusterColor }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: clusterColor }}
          />
          <span className="text-sm font-semibold truncate flex-1">
            {clusterName}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {neuronCount} neuron{neuronCount !== 1 ? "s" : ""}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          Double-click to expand
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2" />
    </>
  );
}

export const ClusterNode = memo(ClusterNodeComponent);

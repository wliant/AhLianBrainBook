"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  Controls,
  Background,
  MarkerType,
  ReactFlowProvider,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { NeuronNode } from "./NeuronNode";
import { NodeDetailPanel } from "./NodeDetailPanel";
import type { BrainExport } from "@/types";

const CLUSTER_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#06b6d4",
  "#84cc16", "#e879f9", "#22d3ee", "#a3e635", "#fb923c",
  "#c084fc", "#34d399", "#fbbf24", "#f472b6", "#60a5fa",
];

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

const nodeTypes = { neuronNode: NeuronNode };

// Edge style per link type
const EDGE_STYLES: Record<string, { strokeDasharray?: string; stroke: string }> = {
  "related-to": { stroke: "#6b7280" },
  "references": { strokeDasharray: "6 3", stroke: "#60a5fa" },
  "depends-on": { strokeDasharray: "2 2", stroke: "#f59e0b" },
  "imports":    { strokeDasharray: "8 4 2 4", stroke: "#10b981" },
  "calls":      { stroke: "#a78bfa" },
  "contains":   { stroke: "#f472b6" },
  "tested-by":  { strokeDasharray: "4 4", stroke: "#34d399" },
};

function getEdgeStyle(linkType?: string | null, dimmed?: boolean) {
  const base = EDGE_STYLES[linkType || ""] || EDGE_STYLES["related-to"];
  return {
    stroke: dimmed ? base.stroke + "33" : base.stroke,
    strokeDasharray: base.strokeDasharray,
    strokeWidth: 1.5,
  };
}

function applyDagreLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

function applyClusteredLayout(
  nodes: Node[],
  edges: Edge[],
  clusters: { id: string; name: string }[]
): Node[] {
  if (nodes.length === 0) return nodes;

  const clusterNodes: Record<string, Node[]> = {};
  const orphans: Node[] = [];
  for (const node of nodes) {
    const cid = (node.data as { clusterId?: string }).clusterId;
    if (cid) {
      if (!clusterNodes[cid]) clusterNodes[cid] = [];
      clusterNodes[cid].push(node);
    } else {
      orphans.push(node);
    }
  }

  const result: Node[] = [];
  let xOffset = 0;
  const CLUSTER_GAP = 100;

  for (const cluster of clusters) {
    const cNodes = clusterNodes[cluster.id];
    if (!cNodes || cNodes.length === 0) continue;

    const cEdges = edges.filter(
      (e) => cNodes.some((n) => n.id === e.source) && cNodes.some((n) => n.id === e.target)
    );

    const laid = applyDagreLayout(cNodes, cEdges);

    let minX = Infinity, maxX = -Infinity;
    for (const n of laid) {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
    }

    const shift = xOffset - minX;
    for (const n of laid) {
      n.position.x += shift;
      result.push(n);
    }

    xOffset = maxX + shift + CLUSTER_GAP;
  }

  if (orphans.length > 0) {
    const laid = applyDagreLayout(orphans, []);
    for (const n of laid) {
      n.position.x += xOffset;
      result.push(n);
    }
  }

  return result;
}

// Compute cluster bounding boxes for background labels
function computeClusterBounds(
  nodes: Node[],
  clusters: { id: string; name: string }[],
  colorMap: Record<string, string>
) {
  const groups: Record<string, { minX: number; minY: number; maxX: number; maxY: number }> = {};
  for (const n of nodes) {
    const cid = (n.data as { clusterId?: string }).clusterId;
    if (!cid) continue;
    if (!groups[cid]) groups[cid] = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const b = groups[cid];
    b.minX = Math.min(b.minX, n.position.x);
    b.minY = Math.min(b.minY, n.position.y);
    b.maxX = Math.max(b.maxX, n.position.x + NODE_WIDTH);
    b.maxY = Math.max(b.maxY, n.position.y + NODE_HEIGHT);
  }

  const PAD = 30;
  return clusters
    .filter((c) => groups[c.id])
    .map((c) => {
      const b = groups[c.id];
      return {
        id: `cluster-bg-${c.id}`,
        type: "default",
        position: { x: b.minX - PAD, y: b.minY - PAD - 20 },
        data: { label: c.name },
        width: b.maxX - b.minX + PAD * 2,
        height: b.maxY - b.minY + PAD * 2 + 20,
        selectable: false,
        draggable: false,
        style: {
          backgroundColor: (colorMap[c.id] || "#6b7280") + "10",
          border: `1px dashed ${(colorMap[c.id] || "#6b7280")}44`,
          borderRadius: "8px",
          fontSize: "11px",
          color: (colorMap[c.id] || "#6b7280") + "aa",
          fontWeight: 600,
          pointerEvents: "none" as const,
          zIndex: -1,
        },
      } as Node;
    });
}

function CustomMiniMap({ nodes, isDark }: { nodes: Node[]; isDark: boolean }) {
  const W = 180;
  const H = 120;

  // Filter out cluster background nodes
  const realNodes = nodes.filter((n) => !n.id.startsWith("cluster-bg-"));
  if (realNodes.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of realNodes) {
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, n.position.y + NODE_HEIGHT);
  }
  const pad = 40;
  minX -= pad; minY -= pad; maxX += pad; maxY += pad;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const scale = Math.min(W / bw, H / bh);

  return (
    <div
      className="absolute bottom-2 right-2 rounded border z-10"
      style={{
        width: W,
        height: H,
        backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
        borderColor: isDark ? "#334155" : "#cbd5e1",
      }}
    >
      <svg width={W} height={H}>
        {realNodes.map((n) => {
          const x = (n.position.x - minX) * scale;
          const y = (n.position.y - minY) * scale;
          const d = n.data as { clusterColor?: string; dimmed?: boolean };
          return (
            <rect
              key={n.id}
              x={x}
              y={y}
              width={NODE_WIDTH * scale}
              height={NODE_HEIGHT * scale}
              fill={d.clusterColor || "#6b7280"}
              opacity={d.dimmed ? 0.2 : 0.8}
              rx={2}
            />
          );
        })}
      </svg>
    </div>
  );
}

function GraphCanvasInner({
  data,
  brainId,
}: {
  data: BrainExport;
  brainId: string;
}) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  const clusterColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    data.clusters.forEach((c, i) => {
      map[c.id] = CLUSTER_COLORS[i % CLUSTER_COLORS.length];
    });
    return map;
  }, [data.clusters]);

  const clusterNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    data.clusters.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [data.clusters]);

  const adjacencyMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const l of data.links) {
      if (!map[l.sourceNeuronId]) map[l.sourceNeuronId] = new Set();
      if (!map[l.targetNeuronId]) map[l.targetNeuronId] = new Set();
      map[l.sourceNeuronId].add(l.targetNeuronId);
      map[l.targetNeuronId].add(l.sourceNeuronId);
    }
    return map;
  }, [data.links]);

  const { nodes, edges } = useMemo(() => {
    const focusNeighbors = focusedNode
      ? new Set([focusedNode, ...(adjacencyMap[focusedNode] || [])])
      : null;

    const rawNodes: Node[] = data.neurons.map((n) => ({
      id: n.id,
      type: "neuronNode",
      position: { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      data: {
        title: n.title,
        clusterName: clusterNameMap[n.clusterId] || "Unknown",
        clusterColor: clusterColorMap[n.clusterId] || "#6b7280",
        complexity: (n as Record<string, unknown>).complexity || null,
        clusterId: n.clusterId,
        dimmed: focusNeighbors ? !focusNeighbors.has(n.id) : false,
      },
    }));

    const nodeIdSet = new Set(rawNodes.map((n) => n.id));

    const rawEdges: Edge[] = data.links
      .filter((l) => nodeIdSet.has(l.sourceNeuronId) && nodeIdSet.has(l.targetNeuronId))
      .map((l) => {
        const dimmed = focusNeighbors
          ? !focusNeighbors.has(l.sourceNeuronId) || !focusNeighbors.has(l.targetNeuronId)
          : false;
        return {
          id: `${l.sourceNeuronId}-${l.targetNeuronId}`,
          source: l.sourceNeuronId,
          target: l.targetNeuronId,
          label: l.linkType || undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: getEdgeStyle(l.linkType, dimmed),
          labelStyle: { fontSize: 9, opacity: dimmed ? 0.2 : 0.7 },
        };
      });

    const layoutNodes = applyClusteredLayout(rawNodes, rawEdges, data.clusters);

    // Add cluster background nodes (behind real nodes)
    const clusterBgs = computeClusterBounds(layoutNodes, data.clusters, clusterColorMap);
    const allNodes = [...clusterBgs, ...layoutNodes];

    return { nodes: allNodes, edges: rawEdges };
  }, [data.neurons, data.links, data.clusters, clusterNameMap, clusterColorMap, focusedNode, adjacencyMap]);

  // Build connections for the selected node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode) return [];
    return data.links
      .filter((l) => l.sourceNeuronId === selectedNode || l.targetNeuronId === selectedNode)
      .map((l) => {
        const isOutgoing = l.sourceNeuronId === selectedNode;
        const otherId = isOutgoing ? l.targetNeuronId : l.sourceNeuronId;
        const otherNeuron = data.neurons.find((n) => n.id === otherId);
        return {
          direction: isOutgoing ? "out" as const : "in" as const,
          neuronId: otherId,
          neuronTitle: otherNeuron?.title || "Unknown",
          clusterId: otherNeuron?.clusterId || "",
          linkType: l.linkType || "related-to",
          label: l.label || undefined,
        };
      });
  }, [selectedNode, data.links, data.neurons]);

  const selectedNodeDetail = useMemo(() => {
    if (!selectedNode) return null;
    const n = data.neurons.find((x) => x.id === selectedNode);
    if (!n) return null;
    return {
      id: n.id,
      title: n.title,
      clusterId: n.clusterId,
      clusterName: clusterNameMap[n.clusterId] || "Unknown",
      contentText: n.contentText,
      tagNames: n.tagNames || [],
    };
  }, [selectedNode, data.neurons, clusterNameMap]);

  const handleNodeClick = useCallback((_: unknown, node: Node) => {
    if (node.id.startsWith("cluster-bg-")) return;
    setSelectedNode(node.id);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.id.startsWith("cluster-bg-")) return;
      const n = data.neurons.find((x) => x.id === node.id);
      if (n) {
        router.push(`/brain/${brainId}/cluster/${n.clusterId}/neuron/${n.id}`);
      }
    },
    [data.neurons, brainId, router]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setFocusedNode(null);
  }, []);

  const handleFocus = useCallback((nodeId: string) => {
    setFocusedNode((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        colorMode={resolvedTheme === "dark" ? "dark" : "light"}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Controls />
        <Background />
      </ReactFlow>
      <CustomMiniMap nodes={nodes} isDark={resolvedTheme === "dark"} />
      {selectedNodeDetail && (
        <NodeDetailPanel
          node={selectedNodeDetail}
          brainId={brainId}
          connections={selectedNodeConnections}
          isFocused={focusedNode === selectedNodeDetail.id}
          onFocus={() => handleFocus(selectedNodeDetail.id)}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

export function GraphCanvas({
  data,
  brainId,
}: {
  data: BrainExport;
  brainId: string;
}) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner data={data} brainId={brainId} />
    </ReactFlowProvider>
  );
}

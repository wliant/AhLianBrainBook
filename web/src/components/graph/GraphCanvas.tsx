"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
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

// Layout nodes grouped by cluster with cluster offsets
function applyClusteredLayout(
  nodes: Node[],
  edges: Edge[],
  clusters: { id: string; name: string }[]
): Node[] {
  if (nodes.length === 0) return nodes;

  // Group nodes by cluster
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

  // Layout each cluster independently, then offset
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

    // Find bounding box
    let minX = Infinity, maxX = -Infinity;
    for (const n of laid) {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + NODE_WIDTH);
    }

    // Shift to xOffset
    const shift = xOffset - minX;
    for (const n of laid) {
      n.position.x += shift;
      result.push(n);
    }

    xOffset = maxX + shift + CLUSTER_GAP;
  }

  // Orphans at the end
  if (orphans.length > 0) {
    const laid = applyDagreLayout(orphans, []);
    for (const n of laid) {
      n.position.x += xOffset;
      result.push(n);
    }
  }

  return result;
}

function GraphCanvasInner({
  data,
  brainId,
}: {
  data: BrainExport;
  brainId: string;
}) {
  const router = useRouter();
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

  // Build adjacency set for focus mode
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
          label: l.label || undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: dimmed ? "#6b728033" : "#6b7280" },
          labelStyle: { fontSize: 10, opacity: dimmed ? 0.2 : 1 },
        };
      });

    const layoutNodes = applyClusteredLayout(rawNodes, rawEdges, data.clusters);
    return { nodes: layoutNodes, edges: rawEdges };
  }, [data.neurons, data.links, data.clusters, clusterNameMap, clusterColorMap, focusedNode, adjacencyMap]);

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
    setSelectedNode(node.id);
  }, []);

  const handleNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
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

  const getNodeColor = useCallback(
    (node: Node) => {
      const d = node.data as { clusterColor?: string };
      return d.clusterColor || "#6b7280";
    },
    []
  );

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={handlePaneClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Controls />
        <Background />
        <MiniMap nodeColor={getNodeColor} pannable zoomable />
      </ReactFlow>
      {selectedNodeDetail && (
        <NodeDetailPanel
          node={selectedNodeDetail}
          brainId={brainId}
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

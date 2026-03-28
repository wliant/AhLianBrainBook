"use client";

import { use } from "react";
import Link from "next/link";
import { FolderOpen, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClusters } from "@/lib/hooks/useClusters";

export default function BrainPage({ params }: { params: Promise<{ brainId: string }> }) {
  const { brainId } = use(params);
  const { clusters, createCluster } = useClusters(brainId);

  const handleNewCluster = async () => {
    const name = prompt("Cluster name:");
    if (name) await createCluster(name);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clusters</h1>
        <Button size="sm" onClick={handleNewCluster}>
          <Plus className="h-4 w-4 mr-1" /> New Cluster
        </Button>
      </div>

      {clusters.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3" />
          <p>No clusters yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {clusters.map((cluster) => (
            <Link
              key={cluster.id}
              href={`/brain/${brainId}/cluster/${cluster.id}`}
              className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent transition-colors"
            >
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">{cluster.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

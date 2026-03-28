"use client";

import { use } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeurons } from "@/lib/hooks/useNeurons";

export default function ClusterPage({
  params,
}: {
  params: Promise<{ brainId: string; clusterId: string }>;
}) {
  const { brainId, clusterId } = use(params);
  const { neurons, createNeuron } = useNeurons(clusterId);

  const handleNewNeuron = async () => {
    const neuron = await createNeuron("Untitled", brainId);
    if (neuron) {
      window.location.href = `/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`;
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Neurons</h1>
        <Button size="sm" onClick={handleNewNeuron}>
          <Plus className="h-4 w-4 mr-1" /> New Neuron
        </Button>
      </div>

      {neurons.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3" />
          <p>No neurons yet. Create one to start writing.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {neurons.map((neuron) => (
            <Link
              key={neuron.id}
              href={`/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{neuron.title || "Untitled"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {neuron.contentText?.slice(0, 100) || "Empty note"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(neuron.lastEditedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

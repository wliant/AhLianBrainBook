"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeurons } from "@/lib/hooks/useNeurons";
import { TagCombobox } from "@/components/tags/TagCombobox";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { api } from "@/lib/api";
import type { Brain, Cluster, Neuron, Tag } from "@/types";

export default function ClusterPage({
  params,
}: {
  params: Promise<{ brainId: string; clusterId: string }>;
}) {
  const { brainId, clusterId } = use(params);
  const { neurons, createNeuron } = useNeurons(clusterId);
  const [neuronTags, setNeuronTags] = useState<Record<string, Tag[]>>({});
  const [breadcrumbItems, setBreadcrumbItems] = useState<{ label: string; href: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Brain>(`/api/brains/${brainId}`),
      api.get<Cluster>(`/api/clusters/${clusterId}`),
    ]).then(([brain, cluster]) => {
      setBreadcrumbItems([
        { label: brain.name, href: `/brain/${brainId}` },
        { label: cluster.name, href: `/brain/${brainId}/cluster/${clusterId}` },
      ]);
    });
  }, [brainId, clusterId]);

  const getTagsForNeuron = (neuron: Neuron): Tag[] => {
    return neuronTags[neuron.id] ?? neuron.tags ?? [];
  };

  const handleTagsChange = (neuronId: string, tags: Tag[]) => {
    setNeuronTags((prev) => ({ ...prev, [neuronId]: tags }));
  };

  const handleNewNeuron = async () => {
    const neuron = await createNeuron("Untitled", brainId);
    if (neuron) {
      window.location.href = `/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Breadcrumb items={breadcrumbItems} />
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto flex-1">
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
            <div key={neuron.id} className="rounded-md hover:bg-accent transition-colors">
              <Link
                href={`/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{neuron.title || "Untitled"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {neuron.contentText?.slice(0, 100) || "Empty note"}
                  </p>
                </div>
                {neuron.complexity && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                    neuron.complexity === "complex" ? "bg-red-500/20 text-red-400" :
                    neuron.complexity === "moderate" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-green-500/20 text-green-400"
                  }`}>
                    {neuron.complexity}
                  </span>
                )}
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(neuron.lastEditedAt).toLocaleDateString()}
                </span>
              </Link>
              <div className="px-3 pb-2 pl-10">
                <TagCombobox
                  entityType="neuron"
                  entityId={neuron.id}
                  currentTags={getTagsForNeuron(neuron)}
                  onTagsChange={(tags) => handleTagsChange(neuron.id, tags)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

"use client";

import { use, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, Plus, Trash2, GripVertical } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { useNeurons } from "@/lib/hooks/useNeurons";
import { TagCombobox } from "@/components/tags/TagCombobox";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EntityMetadata } from "@/components/shared/EntityMetadata";
import { ResearchClusterView } from "@/components/research/ResearchClusterView";
import { ProjectClusterView } from "@/components/project/ProjectClusterView";
import { TodoClusterView } from "@/components/todo/TodoClusterView";
import { api } from "@/lib/api";
import type { Brain, Cluster, Neuron, Tag } from "@/types";

function SortableNeuronRow({
  neuron,
  brainId,
  clusterId,
  onDelete,
  getTagsForNeuron,
  onTagsChange,
}: {
  neuron: Neuron;
  brainId: string;
  clusterId: string;
  onDelete: (id: string) => void;
  getTagsForNeuron: (neuron: Neuron) => Tag[];
  onTagsChange: (neuronId: string, tags: Tag[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: neuron.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-md hover:bg-accent transition-colors group"
      data-testid={`neuron-row-${neuron.id}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <Link
          href={`/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`}
          className="flex items-center gap-3 flex-1 min-w-0"
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
        <button
          className="p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-destructive rounded shrink-0"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(neuron.id);
          }}
          title="Delete neuron"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 pb-2 pl-10">
        <TagCombobox
          entityType="neuron"
          entityId={neuron.id}
          currentTags={getTagsForNeuron(neuron)}
          onTagsChange={(tags) => onTagsChange(neuron.id, tags)}
        />
      </div>
    </div>
  );
}

export default function ClusterPage({
  params,
}: {
  params: Promise<{ brainId: string; clusterId: string }>;
}) {
  const { brainId, clusterId } = use(params);
  const { neurons, createNeuron, deleteNeuron, reorderNeurons } = useNeurons(clusterId);
  const [neuronTags, setNeuronTags] = useState<Record<string, Tag[]>>({});
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [breadcrumbItems, setBreadcrumbItems] = useState<{ label: string; href: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Brain>(`/api/brains/${brainId}`),
      api.get<Cluster>(`/api/clusters/${clusterId}`),
    ]).then(([brain, clusterData]) => {
      setCluster(clusterData);
      setBreadcrumbItems([
        { label: brain.name, href: `/brain/${brainId}` },
        { label: clusterData.name, href: `/brain/${brainId}/cluster/${clusterId}` },
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

  const handleDelete = useCallback(async (neuronId: string) => {
    if (!confirm("Delete this neuron?")) return;
    try {
      await deleteNeuron(neuronId);
    } catch (err) {
      console.error("Failed to delete neuron:", err);
    }
  }, [deleteNeuron]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = neurons.findIndex((n) => n.id === active.id);
    const newIndex = neurons.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...neurons];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    reorderNeurons(reordered.map((n) => n.id));
  }, [neurons, reorderNeurons]);

  return (
    <div className="flex flex-col h-full" data-testid="cluster-page">
      <Breadcrumb items={breadcrumbItems} />
      {cluster?.type === "todo" ? (
        <div className="flex-1 min-h-0">
          <TodoClusterView cluster={cluster} brainId={brainId} />
        </div>
      ) : cluster?.type === "project" ? (
        <div className="flex-1 min-h-0">
          <ProjectClusterView cluster={cluster} brainId={brainId} />
        </div>
      ) : (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl w-full mx-auto flex-1">
          {cluster && (
            <div className="mb-4">
              <EntityMetadata
                createdBy={cluster.createdBy}
                createdAt={cluster.createdAt}
                lastUpdatedBy={cluster.lastUpdatedBy}
                updatedAt={cluster.updatedAt}
              />
            </div>
          )}

          {cluster?.type === "ai-research" ? (
            <ResearchClusterView cluster={cluster} brainId={brainId} />
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Neurons</h1>
                <Button size="sm" onClick={handleNewNeuron} data-testid="new-neuron-btn">
                  <Plus className="h-4 w-4 mr-1" /> New Neuron
                </Button>
              </div>

              {neurons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3" />
                  <p>No neurons yet. Create one to start writing.</p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={neurons.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1">
                      {neurons.map((neuron) => (
                        <SortableNeuronRow
                          key={neuron.id}
                          neuron={neuron}
                          brainId={brainId}
                          clusterId={clusterId}
                          onDelete={handleDelete}
                          getTagsForNeuron={getTagsForNeuron}
                          onTagsChange={handleTagsChange}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

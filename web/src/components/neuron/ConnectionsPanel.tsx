"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNeuronLinks } from "@/lib/hooks/useNeuronLinks";
import { AddLinkDialog } from "./AddLinkDialog";
import type { NeuronLink } from "@/types";

export function ConnectionsPanel({
  neuronId,
  brainId,
  onClose,
}: {
  neuronId: string;
  brainId: string;
  onClose: () => void;
}) {
  const { links, loading, deleteLink, refetch } = useNeuronLinks(neuronId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const outgoing = links.filter((l) => l.sourceNeuronId === neuronId);
  const incoming = links.filter((l) => l.targetNeuronId === neuronId);

  const handleLinkCreated = () => {
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteLink(id);
  };

  return (
    <div className="w-full lg:w-80 lg:border-l flex flex-col h-full bg-background shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">Connections</h3>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Add Link
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading && (
          <p className="text-xs text-muted-foreground px-2 py-4">Loading...</p>
        )}

        {!loading && links.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-4">
            No connections yet. Add a link to connect this neuron to others.
          </p>
        )}

        {outgoing.length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">
              Outgoing ({outgoing.length})
            </h4>
            {outgoing.map((link) => (
              <LinkItem
                key={link.id}
                link={link}
                direction="outgoing"
                brainId={brainId}
                neuronId={neuronId}
                onDelete={() => handleDelete(link.id)}
              />
            ))}
          </div>
        )}

        {incoming.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">
              Backlinks ({incoming.length})
            </h4>
            {incoming.map((link) => (
              <LinkItem
                key={link.id}
                link={link}
                direction="incoming"
                brainId={brainId}
                neuronId={neuronId}
                onDelete={() => handleDelete(link.id)}
              />
            ))}
          </div>
        )}
      </div>

      <AddLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        neuronId={neuronId}
        brainId={brainId}
        onLinkCreated={handleLinkCreated}
      />
    </div>
  );
}

function LinkItem({
  link,
  direction,
  brainId,
  neuronId,
  onDelete,
}: {
  link: NeuronLink;
  direction: "outgoing" | "incoming";
  brainId: string;
  neuronId: string;
  onDelete: () => void;
}) {
  const isOutgoing = direction === "outgoing";
  const title = isOutgoing ? link.targetNeuronTitle : link.sourceNeuronTitle;
  const clusterId = isOutgoing ? link.targetNeuronClusterId : link.sourceNeuronClusterId;
  const linkedNeuronId = isOutgoing ? link.targetNeuronId : link.sourceNeuronId;

  return (
    <div className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent text-sm">
      {isOutgoing ? (
        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
      ) : (
        <ArrowLeft className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <Link
        href={clusterId ? `/brain/${brainId}/cluster/${clusterId}/neuron/${linkedNeuronId}` : "#"}
        className="flex-1 truncate hover:underline"
      >
        {title || "Untitled"}
      </Link>
      {link.linkType && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
          {link.linkType}
        </span>
      )}
      {link.source === "editor" && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 shrink-0">
          wiki
        </span>
      )}
      <button
        onClick={(e) => { e.preventDefault(); onDelete(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

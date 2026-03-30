"use client";

import { use, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import type { Brain, BrainExport } from "@/types";

export default function GraphPage({
  params,
}: {
  params: Promise<{ brainId: string }>;
}) {
  const { brainId } = use(params);
  const [data, setData] = useState<BrainExport | null>(null);
  const [brainName, setBrainName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Brain>(`/api/brains/${brainId}`),
      api.importExport.exportBrain<BrainExport>(brainId),
    ])
      .then(([brain, exportData]) => {
        setBrainName(brain.name);
        setData(exportData);
      })
      .catch((err) => {
        setError(err.message || "Failed to load graph data");
      });
  }, [brainId]);

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Breadcrumb
        items={[
          { label: brainName, href: `/brain/${brainId}` },
          { label: "Knowledge Graph", href: `/brain/${brainId}/graph` },
        ]}
      />
      <div className="flex-1">
        <GraphCanvas data={data} brainId={brainId} />
      </div>
    </div>
  );
}

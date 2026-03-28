"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, FileText } from "lucide-react";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

export default function FavoritesPage() {
  const [neurons, setNeurons] = useState<Neuron[]>([]);

  useEffect(() => {
    api.get<Neuron[]>("/api/neurons/favorites").then(setNeurons).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Star className="h-6 w-6" />
        Favorites
      </h1>

      {neurons.length === 0 ? (
        <p className="text-gray-400 text-center py-12">No favorites yet</p>
      ) : (
        <div className="space-y-1">
          {neurons.map((neuron) => (
            <Link
              key={neuron.id}
              href={`/brain/${neuron.brainId}/cluster/${neuron.clusterId}/neuron/${neuron.id}`}
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-gray-100 transition-colors"
            >
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="flex-1 truncate">{neuron.title || "Untitled"}</span>
              <span className="text-xs text-gray-400">
                {new Date(neuron.lastEditedAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

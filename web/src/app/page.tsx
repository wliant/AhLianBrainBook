"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Brain, FileText, Star, Pin, Clock } from "lucide-react";
import { api } from "@/lib/api";
import type { Neuron } from "@/types";

export default function Dashboard() {
  const [recentNeurons, setRecentNeurons] = useState<Neuron[]>([]);
  const [favoriteNeurons, setFavoriteNeurons] = useState<Neuron[]>([]);
  const [pinnedNeurons, setPinnedNeurons] = useState<Neuron[]>([]);

  useEffect(() => {
    api.get<Neuron[]>("/api/neurons/recent?limit=10").then(setRecentNeurons).catch(() => {});
    api.get<Neuron[]>("/api/neurons/favorites").then(setFavoriteNeurons).catch(() => {});
    api.get<Neuron[]>("/api/neurons/pinned").then(setPinnedNeurons).catch(() => {});
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8" />
          BrainBook
        </h1>
        <p className="text-gray-500 mt-1">Your personal technical notebook</p>
      </div>

      {pinnedNeurons.length > 0 && (
        <NeuronSection title="Pinned" icon={<Pin className="h-4 w-4" />} neurons={pinnedNeurons} />
      )}

      {favoriteNeurons.length > 0 && (
        <NeuronSection title="Favorites" icon={<Star className="h-4 w-4" />} neurons={favoriteNeurons} />
      )}

      <NeuronSection title="Recent" icon={<Clock className="h-4 w-4" />} neurons={recentNeurons} />
    </div>
  );
}

function NeuronSection({ title, icon, neurons }: { title: string; icon: React.ReactNode; neurons: Neuron[] }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
        {icon}
        {title}
      </h2>
      {neurons.length === 0 ? (
        <p className="text-sm text-gray-400">No neurons yet</p>
      ) : (
        <div className="space-y-1">
          {neurons.map((neuron) => (
            <Link
              key={neuron.id}
              href={`/brain/${neuron.brainId}/cluster/${neuron.clusterId}/neuron/${neuron.id}`}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
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

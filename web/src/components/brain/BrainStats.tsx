"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { FolderOpen, FileText, Tag, Link2, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";

interface BrainStatsData {
  clusterCount: number;
  neuronCount: number;
  tagCount: number;
  linkCount: number;
  simpleCount: number;
  moderateCount: number;
  complexCount: number;
  mostConnected: Array<{ id: string; title: string; clusterId: string; linkCount: number }>;
  recentlyEdited: Array<{ id: string; title: string; clusterId: string; lastEditedAt: string }>;
}

export function BrainStats({ brainId }: { brainId: string }) {
  const [stats, setStats] = useState<BrainStatsData | null>(null);

  useEffect(() => {
    api.get<BrainStatsData>(`/api/brains/${brainId}/stats`).then(setStats).catch(() => {});
  }, [brainId]);

  if (!stats) return null;

  const total = stats.simpleCount + stats.moderateCount + stats.complexCount;

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<FolderOpen className="h-4 w-4" />} label="Clusters" value={stats.clusterCount} />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Neurons" value={stats.neuronCount} />
        <StatCard icon={<Tag className="h-4 w-4" />} label="Tags" value={stats.tagCount} />
        <StatCard icon={<Link2 className="h-4 w-4" />} label="Links" value={stats.linkCount} />
      </div>

      {total > 0 && (
        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Complexity</span>
          </div>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
            {stats.simpleCount > 0 && (
              <div
                className="bg-green-500 rounded-full"
                style={{ width: `${(stats.simpleCount / total) * 100}%` }}
                title={`Simple: ${stats.simpleCount}`}
              />
            )}
            {stats.moderateCount > 0 && (
              <div
                className="bg-yellow-500 rounded-full"
                style={{ width: `${(stats.moderateCount / total) * 100}%` }}
                title={`Moderate: ${stats.moderateCount}`}
              />
            )}
            {stats.complexCount > 0 && (
              <div
                className="bg-red-500 rounded-full"
                style={{ width: `${(stats.complexCount / total) * 100}%` }}
                title={`Complex: ${stats.complexCount}`}
              />
            )}
          </div>
          <div className="flex gap-4 mt-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Simple: {stats.simpleCount}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Moderate: {stats.moderateCount}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Complex: {stats.complexCount}</span>
          </div>
        </div>
      )}

      {stats.mostConnected.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-sm font-medium mb-2">Most Connected</p>
          <div className="space-y-1">
            {stats.mostConnected.map((n) => (
              <Link
                key={n.id}
                href={`/brain/${brainId}/cluster/${n.clusterId}/neuron/${n.id}`}
                className="flex items-center gap-2 text-sm hover:bg-accent rounded px-2 py-1"
              >
                <span className="flex-1 truncate">{n.title}</span>
                <span className="text-xs text-muted-foreground">{n.linkCount} links</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 flex items-center gap-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-lg font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

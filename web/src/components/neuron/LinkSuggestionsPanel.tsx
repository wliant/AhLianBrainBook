"use client";

import Link from "next/link";
import { Link2, ArrowRight, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLinkSuggestions } from "@/lib/hooks/useLinkSuggestions";
import type { LinkSuggestion } from "@/types";

const DISPLAY_TYPE_CONFIG = {
  references: { label: "References", icon: ArrowRight },
  referenced_by: { label: "Referenced By", icon: ArrowLeft },
  related: { label: "Related", icon: Sparkles },
} as const;

export function LinkSuggestionsPanel({
  neuronId,
  brainId,
}: {
  neuronId: string;
  brainId: string;
}) {
  const { suggestions, loading, acceptSuggestion } =
    useLinkSuggestions(neuronId);

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground px-2 py-2">
        Loading suggestions...
      </p>
    );
  }

  if (suggestions.length === 0) return null;

  const grouped = {
    references: suggestions.filter((s) => s.displayType === "references"),
    referenced_by: suggestions.filter((s) => s.displayType === "referenced_by"),
    related: suggestions.filter((s) => s.displayType === "related"),
  };

  return (
    <div className="mt-2" data-testid="link-suggestions-panel">
      <h4 className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">
        Suggestions ({suggestions.length})
      </h4>
      {(Object.keys(grouped) as Array<keyof typeof grouped>).map((type) => {
        const items = grouped[type];
        if (items.length === 0) return null;
        const config = DISPLAY_TYPE_CONFIG[type];
        const Icon = config.icon;

        return (
          <div key={type} className="mb-2">
            <p className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {config.label}
            </p>
            {items.map((suggestion) => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                neuronId={neuronId}
                brainId={brainId}
                onAccept={() => acceptSuggestion(suggestion.id)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SuggestionItem({
  suggestion,
  neuronId,
  brainId,
  onAccept,
}: {
  suggestion: LinkSuggestion;
  neuronId: string;
  brainId: string;
  onAccept: () => void;
}) {
  const isSource = suggestion.sourceNeuronId === neuronId;
  const title = isSource
    ? suggestion.targetNeuronTitle
    : suggestion.sourceNeuronTitle;
  const clusterId = isSource
    ? suggestion.targetNeuronClusterId
    : suggestion.sourceNeuronClusterId;
  const linkedNeuronId = isSource
    ? suggestion.targetNeuronId
    : suggestion.sourceNeuronId;

  return (
    <div
      className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent text-sm"
      data-testid={`suggestion-item-${suggestion.id}`}
    >
      <Link
        href={
          clusterId
            ? `/brain/${brainId}/cluster/${clusterId}/neuron/${linkedNeuronId}`
            : "#"
        }
        className="flex-1 truncate hover:underline text-muted-foreground"
      >
        {title || "Untitled"}
      </Link>
      {suggestion.displayType === "related" && suggestion.score != null && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
          {Math.round(suggestion.score * 100)}%
        </span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.preventDefault();
          onAccept();
        }}
        data-testid={`accept-suggestion-${suggestion.id}`}
      >
        <Link2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

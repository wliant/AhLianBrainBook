"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import Link from "next/link";
import { createSuggestionRenderer } from "./suggestionRenderer";
import type { NeuronSummary } from "@/types";
import { api } from "@/lib/api";

function WikiLinkView({ node }: { node: { attrs: Record<string, unknown> } }) {
  const href = (node.attrs.href as string) || "#";
  const title = (node.attrs.neuronTitle as string) || "Untitled";
  return (
    <NodeViewWrapper as="span" className="inline">
      <Link
        href={href}
        className="text-primary underline cursor-pointer hover:text-primary/80"
      >
        {title}
      </Link>
    </NodeViewWrapper>
  );
}

export interface WikiLinkOptions {
  brainId?: string;
}

export const WikiLink = Node.create<WikiLinkOptions>({
  name: "wikiLink",
  group: "inline",
  inline: true,
  atom: true,

  addOptions() {
    return {
      brainId: undefined,
    };
  },

  addAttributes() {
    return {
      neuronId: { default: null },
      neuronTitle: { default: null },
      href: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wiki-link]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ "data-wiki-link": "" }, HTMLAttributes), HTMLAttributes.neuronTitle || ""];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkView);
  },

  addProseMirrorPlugins() {
    const brainId = this.options.brainId;

    return [
      Suggestion<NeuronSummary>({
        editor: this.editor,
        pluginKey: new PluginKey("wikiLink"),
        char: "[[",
        items: ({ query }) => {
          if (!query || query.length < 1) {
            return Promise.resolve([]);
          }
          return new Promise((resolve) => {
            const timer = setTimeout(async () => {
              try {
                const params = new URLSearchParams({ title: query, limit: "10" });
                if (brainId) params.set("brainId", brainId);
                const results = await api.get<NeuronSummary[]>(`/api/neurons/search?${params}`);
                resolve(results);
              } catch (error) {
                console.error("Failed to search neurons for wiki link:", error);
                resolve([]);
              }
            }, 200);
            // TipTap's Suggestion plugin calls items() again on each keystroke,
            // creating a new promise. The old promise's timer is orphaned but harmless
            // since it resolves an already-superseded promise.
            void timer;
          });
        },
        command: ({ editor, range, props: neuron }) => {
          const href = `/brain/${neuron.brainId}/cluster/${neuron.clusterId}/neuron/${neuron.id}`;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "wikiLink",
              attrs: {
                neuronId: neuron.id,
                neuronTitle: neuron.title,
                href,
              },
            })
            .run();
        },
        render: createSuggestionRenderer<NeuronSummary>({
          renderItem: (item) => (
            <span className="truncate">{item.title || "Untitled"}</span>
          ),
          getKey: (item) => item.id,
          emptyMessage: "No matching neurons",
        }),
      }),
    ];
  },
});

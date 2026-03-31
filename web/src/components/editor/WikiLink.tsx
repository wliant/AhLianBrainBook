"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { createRoot } from "react-dom/client";
import Link from "next/link";
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { NeuronSummary } from "@/types";
import { api } from "@/lib/api";

// The inline component that renders a wiki link in the editor
function WikiLinkView({ node }: { node: { attrs: Record<string, unknown> } }) {
  const href = (node.attrs.href as string) || "#";
  const title = (node.attrs.neuronTitle as string) || "Untitled";
  return (
    <NodeViewWrapper as="span" className="inline">
      <Link
        href={href}
        className="text-primary underline cursor-pointer hover:text-primary/80"
        onClick={(e) => e.stopPropagation()}
      >
        {title}
      </Link>
    </NodeViewWrapper>
  );
}

interface SuggestionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const SuggestionList = forwardRef<SuggestionListRef, SuggestionProps<NeuronSummary>>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectItem = useCallback(
      (index: number) => {
        const item = props.items[index];
        if (item) {
          props.command(item);
        }
      },
      [props]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i <= 0 ? props.items.length - 1 : i - 1));
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i >= props.items.length - 1 ? 0 : i + 1));
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    useEffect(() => {
      const selected = containerRef.current?.querySelector("[data-selected]");
      selected?.scrollIntoView({ block: "nearest" });
    }, [selectedIndex]);

    if (props.items.length === 0) {
      return (
        <div className="z-50 rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md">
          No matching neurons
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="z-50 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md w-64"
      >
        {props.items.map((item, index) => (
          <button
            key={item.id}
            data-selected={index === selectedIndex ? "" : undefined}
            className={`flex w-full px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
            }`}
            onClick={() => selectItem(index)}
          >
            <span className="truncate">{item.title || "Untitled"}</span>
          </button>
        ))}
      </div>
    );
  }
);

SuggestionList.displayName = "SuggestionList";

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
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    return [
      Suggestion<NeuronSummary>({
        editor: this.editor,
        char: "[[",
        items: ({ query }) => {
          return new Promise((resolve) => {
            if (debounceTimer) clearTimeout(debounceTimer);
            if (!query || query.length < 1) {
              resolve([]);
              return;
            }
            debounceTimer = setTimeout(async () => {
              try {
                const params = new URLSearchParams({ title: query, limit: "10" });
                if (brainId) params.set("brainId", brainId);
                const results = await api.get<NeuronSummary[]>(`/api/neurons/search?${params}`);
                resolve(results);
              } catch {
                resolve([]);
              }
            }, 200);
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
        render: () => {
          let root: ReturnType<typeof createRoot> | null = null;
          let container: HTMLDivElement | null = null;
          let componentRef: SuggestionListRef | null = null;

          return {
            onStart: (props) => {
              container = document.createElement("div");
              container.style.position = "absolute";
              container.style.zIndex = "50";
              document.body.appendChild(container);

              root = createRoot(container);
              root.render(
                <SuggestionList
                  {...props}
                  ref={(ref) => { componentRef = ref; }}
                />
              );

              const { clientRect } = props;
              if (clientRect && container) {
                const rect = clientRect();
                if (rect) {
                  container.style.left = `${rect.left}px`;
                  container.style.top = `${rect.bottom + 4}px`;
                }
              }
            },
            onUpdate: (props) => {
              if (root && container) {
                root.render(
                  <SuggestionList
                    {...props}
                    ref={(ref) => { componentRef = ref; }}
                  />
                );
                const { clientRect } = props;
                if (clientRect) {
                  const rect = clientRect();
                  if (rect) {
                    container.style.left = `${rect.left}px`;
                    container.style.top = `${rect.bottom + 4}px`;
                  }
                }
              }
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                if (root && container) {
                  root.unmount();
                  container.remove();
                  root = null;
                  container = null;
                }
                return true;
              }
              return componentRef?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              if (root && container) {
                root.unmount();
                container.remove();
                root = null;
                container = null;
              }
            },
          };
        },
      }),
    ];
  },
});

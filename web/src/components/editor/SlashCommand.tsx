"use client";

import { Extension } from "@tiptap/core";
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
import type { SuggestionProps, SuggestionKeyDownProps } from "@tiptap/suggestion";
import type { SectionType } from "@/types";

interface SlashCommandItem {
  title: string;
  description: string;
  category: "format" | "section";
  action?: string; // TipTap command name for format items
  sectionType?: SectionType; // Section type for section items
}

const SLASH_ITEMS: SlashCommandItem[] = [
  // Format items (handled within TipTap)
  { title: "Heading 1", description: "Large heading", category: "format", action: "h1" },
  { title: "Heading 2", description: "Medium heading", category: "format", action: "h2" },
  { title: "Heading 3", description: "Small heading", category: "format", action: "h3" },
  { title: "Bullet List", description: "Unordered list", category: "format", action: "bulletList" },
  { title: "Numbered List", description: "Ordered list", category: "format", action: "orderedList" },
  { title: "Checklist", description: "Task list with checkboxes", category: "format", action: "taskList" },
  { title: "Blockquote", description: "Quote block", category: "format", action: "blockquote" },
  { title: "Code Block", description: "Syntax-highlighted code", category: "format", action: "codeBlock" },
  { title: "Divider", description: "Horizontal rule", category: "format", action: "horizontalRule" },
  // Section items (insert new section after current)
  { title: "Code Editor", description: "Monaco code editor with language support", category: "section", sectionType: "code" },
  { title: "Math Equation", description: "KaTeX math formula", category: "section", sectionType: "math" },
  { title: "Diagram", description: "Mermaid diagram", category: "section", sectionType: "diagram" },
  { title: "Callout", description: "Info, warning, or tip callout", category: "section", sectionType: "callout" },
  { title: "Image", description: "Upload or link an image", category: "section", sectionType: "image" },
  { title: "Table", description: "Data table", category: "section", sectionType: "table" },
  { title: "Audio", description: "Record or upload audio", category: "section", sectionType: "audio" },
];

interface CommandListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const CommandList = forwardRef<CommandListRef, SuggestionProps<SlashCommandItem>>(
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
          No matching commands
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="z-50 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md w-64"
      >
        {props.items.map((item, index) => (
          <button
            key={item.title}
            data-selected={index === selectedIndex ? "" : undefined}
            className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
            }`}
            onClick={() => selectItem(index)}
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.description}</span>
          </button>
        ))}
      </div>
    );
  }
);

CommandList.displayName = "CommandList";

export interface SlashCommandOptions {
  onInsertSection?: (type: SectionType) => void;
}

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      onInsertSection: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: "/",
        startOfLine: false,
        items: ({ query }) => {
          return SLASH_ITEMS.filter(
            (item) =>
              item.title.toLowerCase().includes(query.toLowerCase()) ||
              item.description.toLowerCase().includes(query.toLowerCase())
          );
        },
        command: ({ editor, range, props: item }) => {
          // Delete the slash command text
          editor.chain().focus().deleteRange(range).run();

          if (item.category === "format") {
            switch (item.action) {
              case "h1":
                editor.chain().focus().toggleHeading({ level: 1 }).run();
                break;
              case "h2":
                editor.chain().focus().toggleHeading({ level: 2 }).run();
                break;
              case "h3":
                editor.chain().focus().toggleHeading({ level: 3 }).run();
                break;
              case "bulletList":
                editor.chain().focus().toggleBulletList().run();
                break;
              case "orderedList":
                editor.chain().focus().toggleOrderedList().run();
                break;
              case "taskList":
                editor.chain().focus().toggleBulletList().run();
                break;
              case "blockquote":
                editor.chain().focus().toggleBlockquote().run();
                break;
              case "codeBlock":
                editor.chain().focus().toggleCodeBlock().run();
                break;
              case "horizontalRule":
                editor.chain().focus().setHorizontalRule().run();
                break;
            }
          } else if (item.category === "section" && item.sectionType) {
            this.options.onInsertSection?.(item.sectionType);
          }
        },
        render: () => {
          let root: ReturnType<typeof createRoot> | null = null;
          let container: HTMLDivElement | null = null;
          let componentRef: CommandListRef | null = null;

          return {
            onStart: (props) => {
              container = document.createElement("div");
              container.style.position = "absolute";
              container.style.zIndex = "50";
              document.body.appendChild(container);

              root = createRoot(container);
              root.render(
                <CommandList
                  {...props}
                  ref={(ref) => {
                    componentRef = ref;
                  }}
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
                  <CommandList
                    {...props}
                    ref={(ref) => {
                      componentRef = ref;
                    }}
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

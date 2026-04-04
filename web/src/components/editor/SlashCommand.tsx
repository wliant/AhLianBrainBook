"use client";

import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { createSuggestionRenderer } from "./suggestionRenderer";
import type { SectionType } from "@/types";

interface SlashCommandItem {
  title: string;
  description: string;
  category: "format" | "section";
  action?: string;
  sectionType?: SectionType;
}

const SLASH_ITEMS: SlashCommandItem[] = [
  { title: "Heading 1", description: "Large heading", category: "format", action: "h1" },
  { title: "Heading 2", description: "Medium heading", category: "format", action: "h2" },
  { title: "Heading 3", description: "Small heading", category: "format", action: "h3" },
  { title: "Bullet List", description: "Unordered list", category: "format", action: "bulletList" },
  { title: "Numbered List", description: "Ordered list", category: "format", action: "orderedList" },
  { title: "Checklist", description: "Task list with checkboxes", category: "format", action: "taskList" },
  { title: "Blockquote", description: "Quote block", category: "format", action: "blockquote" },
  { title: "Code Block", description: "Syntax-highlighted code", category: "format", action: "codeBlock" },
  { title: "Divider", description: "Horizontal rule", category: "format", action: "horizontalRule" },
  { title: "Code Editor", description: "Monaco code editor with language support", category: "section", sectionType: "code" },
  { title: "Math Equation", description: "KaTeX math formula", category: "section", sectionType: "math" },
  { title: "Diagram", description: "Mermaid diagram", category: "section", sectionType: "diagram" },
  { title: "Callout", description: "Info, warning, or tip callout", category: "section", sectionType: "callout" },
  { title: "Image", description: "Upload or link an image", category: "section", sectionType: "image" },
  { title: "Table", description: "Data table", category: "section", sectionType: "table" },
  { title: "Audio", description: "Record or upload audio", category: "section", sectionType: "audio" },
];

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
        pluginKey: new PluginKey("slashCommand"),
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
                editor.chain().focus().toggleTaskList().run();
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
        render: createSuggestionRenderer<SlashCommandItem>({
          renderItem: (item) => (
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </div>
          ),
          getKey: (item) => `${item.category}-${item.title}`,
          emptyMessage: "No matching commands",
        }),
      }),
    ];
  },
});

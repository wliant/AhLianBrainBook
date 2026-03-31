"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { InlineCheckbox } from "./InlineCheckbox";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Typography from "@tiptap/extension-typography";
import { common, createLowlight } from "lowlight";
import { Toolbar } from "./Toolbar";
import { SlashCommand } from "./SlashCommand";
import { WikiLink } from "./WikiLink";
import type { SectionType } from "@/types";

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: Record<string, unknown> | null;
  onUpdate: (json: Record<string, unknown>, text: string) => void;
  editable?: boolean;
  onInsertSection?: (type: SectionType) => void;
  brainId?: string;
}

export function TiptapEditor({ content, onUpdate, editable = true, onInsertSection, brainId }: TiptapEditorProps) {
  const router = useRouter();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Image.configure({
        HTMLAttributes: { class: "max-w-full rounded-lg" },
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      InlineCheckbox,
      Placeholder.configure({
        placeholder: "Start writing... Use / for commands",
      }),
      Highlight,
      CodeBlockLowlight.configure({ lowlight }),
      Typography,
      SlashCommand.configure({
        onInsertSection,
      }),
      WikiLink.configure({
        brainId,
      }),
    ],
    content: content || undefined,
    editable,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as Record<string, unknown>;
      const text = editor.getText();
      onUpdate(json, text);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none px-0",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      // Internal links start with /
      if (href.startsWith("/")) {
        e.preventDefault();
        router.push(href);
      } else if (!editable) {
        // In view mode, open external links in new tab
        e.preventDefault();
        window.open(href, "_blank", "noopener");
      }
    },
    [router, editable]
  );

  return (
    <div className={editable ? "min-h-[100px]" : ""} onClick={handleClick}>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

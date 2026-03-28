"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import LinkExtension from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Typography from "@tiptap/extension-typography";
import { common, createLowlight } from "lowlight";
import { Toolbar } from "./Toolbar";

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content: Record<string, unknown> | null;
  onUpdate: (json: Record<string, unknown>, text: string) => void;
  editable?: boolean;
}

export function TiptapEditor({ content, onUpdate, editable = true }: TiptapEditorProps) {
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
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "Start writing... Use / for commands",
      }),
      Highlight,
      CodeBlockLowlight.configure({ lowlight }),
      Typography,
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

  return (
    <div className={editable ? "min-h-[60vh]" : ""}>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

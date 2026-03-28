"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Type,
  Code,
  FunctionSquare,
  GitBranch,
  MessageSquare,
  Minus,
  ImageIcon,
  TableIcon,
} from "lucide-react";
import type { SectionType } from "@/types";

const SECTION_OPTIONS: { type: SectionType; label: string; icon: React.ReactNode }[] = [
  { type: "rich-text", label: "Rich Text", icon: <Type className="h-4 w-4" /> },
  { type: "code", label: "Code", icon: <Code className="h-4 w-4" /> },
  { type: "math", label: "Math Equation", icon: <FunctionSquare className="h-4 w-4" /> },
  { type: "diagram", label: "Diagram", icon: <GitBranch className="h-4 w-4" /> },
  { type: "callout", label: "Callout", icon: <MessageSquare className="h-4 w-4" /> },
  { type: "divider", label: "Divider", icon: <Minus className="h-4 w-4" /> },
  { type: "image", label: "Image", icon: <ImageIcon className="h-4 w-4" /> },
  { type: "table", label: "Table", icon: <TableIcon className="h-4 w-4" /> },
];

interface AddSectionButtonProps {
  onAdd: (type: SectionType) => void;
}

export function AddSectionButton({ onAdd }: AddSectionButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1 px-2 rounded hover:bg-muted transition-colors">
          <Plus className="h-3.5 w-3.5" />
          Add section
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {SECTION_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.type} onClick={() => onAdd(opt.type)}>
            <span className="mr-2">{opt.icon}</span>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

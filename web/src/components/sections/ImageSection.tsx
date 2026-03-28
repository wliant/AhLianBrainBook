"use client";

import { useState } from "react";
import type { Section } from "@/types";
import { ImageIcon } from "lucide-react";

interface ImageSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
  editing?: boolean;
}

export function ImageSection({ section, onUpdate, editing = true }: ImageSectionProps) {
  const src = (section.content.src as string) || "";
  const caption = (section.content.caption as string) || "";
  const [showUrlInput, setShowUrlInput] = useState(!src);

  if (editing && (!src || showUrlInput)) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex flex-col items-center gap-3">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
          <input
            type="text"
            value={src}
            onChange={(e) => onUpdate({ src: e.target.value, caption })}
            onBlur={() => src && setShowUrlInput(false)}
            placeholder="Paste image URL..."
            className="w-full text-sm border rounded px-3 py-1.5 bg-transparent outline-none"
            autoFocus
          />
        </div>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground italic">
        No image
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="relative group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || "Image"}
          className="max-w-full mx-auto"
          onError={() => editing && setShowUrlInput(true)}
        />
        {editing && (
          <button
            onClick={() => setShowUrlInput(true)}
            className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Change
          </button>
        )}
      </div>
      {editing ? (
        <input
          type="text"
          value={caption}
          onChange={(e) => onUpdate({ src, caption: e.target.value })}
          placeholder="Add a caption..."
          className="w-full px-3 py-2 text-sm text-center bg-transparent border-t outline-none text-muted-foreground"
        />
      ) : (
        caption && <p className="px-3 py-2 text-sm text-center text-muted-foreground border-t">{caption}</p>
      )}
    </div>
  );
}

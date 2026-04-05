"use client";

import { useState } from "react";
import type { FileContent } from "@/types";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  webp: "image/webp",
  bmp: "image/bmp",
};

function getMimeType(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "image/png";
  const ext = path.substring(dot + 1).toLowerCase();
  return MIME_TYPES[ext] ?? "image/png";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ImageViewerProps {
  fileContent: FileContent;
}

export function ImageViewer({ fileContent }: ImageViewerProps) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState(false);

  const mimeType = getMimeType(fileContent.path);
  const dataUrl = `data:${mimeType};base64,${fileContent.content}`;

  return (
    <div className="flex flex-col h-full">
      {/* File path header — matches CodeViewer style */}
      <div className="px-3 py-1.5 border-b text-xs text-muted-foreground bg-muted/30 flex items-center gap-3">
        <span className="truncate">{fileContent.path}</span>
        <span className="shrink-0 opacity-60">
          {formatSize(fileContent.size)}
          {dimensions && ` · ${dimensions.w}×${dimensions.h}`}
        </span>
      </div>

      {/* Image display */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[#1e1e1e]">
        {error ? (
          <div className="text-sm text-muted-foreground text-center">
            <p>Failed to load image.</p>
            <p className="text-xs mt-1 opacity-60">{fileContent.path}</p>
          </div>
        ) : (
          /* Checkerboard background for transparency */
          <div
            className="inline-block rounded-md"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          >
            <img
              src={dataUrl}
              alt={fileContent.path}
              className="max-w-full max-h-[70vh] object-contain"
              onLoad={(e) => {
                const img = e.currentTarget;
                setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              onError={() => setError(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

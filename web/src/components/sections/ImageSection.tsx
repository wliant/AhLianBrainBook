"use client";

import { useState, useRef, useCallback } from "react";
import type { Section, Attachment } from "@/types";
import { ImageIcon, Upload, Link, Loader2 } from "lucide-react";
import { useAttachmentUpload } from "@/lib/hooks/useAttachmentUpload";

interface ImageSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
  editing?: boolean;
  neuronId?: string;
}

export function ImageSection({ section, onUpdate, editing = true, neuronId }: ImageSectionProps) {
  const src = (section.content.src as string) || "";
  const caption = (section.content.caption as string) || "";
  const [showInput, setShowInput] = useState(!src);
  const [inputMode, setInputMode] = useState<"url" | "upload">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onUploaded = useCallback(
    (downloadUrl: string, attachment: Attachment) => {
      onUpdate({
        src: downloadUrl,
        caption,
        sourceType: "upload",
        attachmentId: attachment.id,
      });
      setShowInput(false);
    },
    [onUpdate, caption]
  );

  const { upload, uploading, error: uploadError, clearError } =
    useAttachmentUpload({ neuronId, onUploaded });

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) upload(file);
        return;
      }
    }
  };

  if (editing && (!src || showInput)) {
    return (
      <div className="border rounded-lg p-4" onPaste={handlePaste} tabIndex={0}>
        <div className="flex flex-col items-center gap-3">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />

          <div className="flex gap-2 text-xs">
            <button
              onClick={() => { setInputMode("upload"); clearError(); }}
              className={`px-3 py-1 rounded ${inputMode === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <Upload className="h-3 w-3 inline mr-1" />
              Upload
            </button>
            <button
              onClick={() => { setInputMode("url"); clearError(); }}
              className={`px-3 py-1 rounded ${inputMode === "url" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <Link className="h-3 w-3 inline mr-1" />
              URL
            </button>
          </div>

          {inputMode === "upload" ? (
            <div className="w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload(file);
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !neuronId}
                className="w-full py-3 border-2 border-dashed rounded-lg text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  "Click to choose or paste an image"
                )}
              </button>
              {uploadError && (
                <p className="mt-2 text-xs text-destructive text-center">{uploadError}</p>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={src}
              onChange={(e) => onUpdate({ src: e.target.value, caption, sourceType: "url" })}
              onBlur={() => src && setShowInput(false)}
              placeholder="Paste image URL..."
              className="w-full text-sm border rounded px-3 py-1.5 bg-transparent outline-none"
              autoFocus
            />
          )}
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
          onError={() => editing && setShowInput(true)}
        />
        {editing && (
          <button
            onClick={() => setShowInput(true)}
            className="absolute top-2 right-2 text-xs bg-black/50 text-white px-2 py-1 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          >
            Change
          </button>
        )}
      </div>
      {editing ? (
        <input
          type="text"
          value={caption}
          onChange={(e) => onUpdate({ src, caption: e.target.value, sourceType: section.content.sourceType, attachmentId: section.content.attachmentId })}
          placeholder="Add a caption..."
          className="w-full px-3 py-2 text-sm text-center bg-transparent border-t outline-none text-muted-foreground"
        />
      ) : (
        caption && <p className="px-3 py-2 text-sm text-center text-muted-foreground border-t">{caption}</p>
      )}
    </div>
  );
}

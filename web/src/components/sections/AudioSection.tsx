"use client";

import { useState, useRef, useCallback } from "react";
import type { Section, Attachment } from "@/types";
import { Music, Upload, Mic, Square, Loader2 } from "lucide-react";
import { useAttachmentUpload } from "@/lib/hooks/useAttachmentUpload";
import { useAudioRecorder } from "@/lib/hooks/useAudioRecorder";

interface AudioSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
  editing?: boolean;
  neuronId?: string;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioSection({ section, onUpdate, editing = true, neuronId }: AudioSectionProps) {
  const src = (section.content.src as string) || "";
  const label = (section.content.label as string) || "";
  const sourceType = (section.content.sourceType as string) || "upload";
  const attachmentId = section.content.attachmentId as string | undefined;

  const [showInput, setShowInput] = useState(!src);
  const [inputMode, setInputMode] = useState<"upload" | "record">("upload");
  const isRecordingUploadRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onUploaded = useCallback(
    (downloadUrl: string, attachment: Attachment) => {
      if (isRecordingUploadRef.current) {
        const now = new Date();
        const dateLabel = `Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        onUpdate({
          src: downloadUrl,
          label: dateLabel,
          sourceType: "recording",
          attachmentId: attachment.id,
        });
        isRecordingUploadRef.current = false;
      } else {
        onUpdate({
          src: downloadUrl,
          label: attachment.fileName,
          sourceType: "upload",
          attachmentId: attachment.id,
        });
      }
      setShowInput(false);
    },
    [onUpdate]
  );

  const { upload, uploading, error: uploadError, clearError: clearUploadError } =
    useAttachmentUpload({ neuronId, onUploaded });

  const onRecordingComplete = useCallback(
    (file: File) => {
      isRecordingUploadRef.current = true;
      upload(file);
    },
    [upload]
  );

  const {
    isRecording,
    duration,
    error: recordError,
    start: startRecording,
    stop: stopRecording,
    clearError: clearRecordError,
  } = useAudioRecorder({ onRecordingComplete });

  const handleFileSelect = useCallback(
    (file: File) => {
      isRecordingUploadRef.current = false;
      upload(file);
    },
    [upload]
  );

  // Edit mode, no audio — show input
  if (editing && (!src || showInput)) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex flex-col items-center gap-3">
          <Music className="h-8 w-8 text-muted-foreground" />

          <div className="flex gap-2 text-xs">
            <button
              onClick={() => { setInputMode("upload"); clearRecordError(); clearUploadError(); }}
              className={`px-3 py-1 rounded ${inputMode === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <Upload className="h-3 w-3 inline mr-1" />
              Upload
            </button>
            <button
              onClick={() => { setInputMode("record"); clearRecordError(); clearUploadError(); }}
              className={`px-3 py-1 rounded ${inputMode === "record" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <Mic className="h-3 w-3 inline mr-1" />
              Record
            </button>
          </div>

          {inputMode === "upload" ? (
            <div className="w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a,.flac,.aac"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
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
                  "Click to choose an audio file"
                )}
              </button>
              {uploadError && (
                <p className="mt-2 text-xs text-destructive text-center">{uploadError}</p>
              )}
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-3">
              {isRecording ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono">{formatDuration(duration)}</span>
                  </div>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                    Stop Recording
                  </button>
                </>
              ) : uploading ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading recording...
                </span>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={!neuronId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed hover:border-red-500 hover:text-red-500 transition-colors text-sm text-muted-foreground disabled:opacity-50"
                >
                  <Mic className="h-4 w-4" />
                  Start Recording
                </button>
              )}
              {(recordError || uploadError) && (
                <p className="text-xs text-destructive text-center">{recordError || uploadError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // No audio (view mode)
  if (!src) {
    return (
      <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground italic">
        No audio
      </div>
    );
  }

  // Has audio — show player
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="relative group p-3">
        <audio controls src={src} className="w-full" preload="metadata" />
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
          value={label}
          onChange={(e) => onUpdate({ src, label: e.target.value, sourceType, attachmentId })}
          placeholder="Add a label..."
          className="w-full px-3 py-2 text-sm text-center bg-transparent border-t outline-none text-muted-foreground"
        />
      ) : (
        label && <p className="px-3 py-2 text-sm text-center text-muted-foreground border-t">{label}</p>
      )}
    </div>
  );
}

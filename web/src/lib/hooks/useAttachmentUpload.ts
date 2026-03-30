import { useState, useCallback } from "react";
import type { Attachment } from "@/types";
import { api } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface UseAttachmentUploadOptions {
  neuronId?: string;
  onUploaded: (downloadUrl: string, attachment: Attachment) => void;
}

export function useAttachmentUpload({ neuronId, onUploaded }: UseAttachmentUploadOptions) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!neuronId) return;
      setUploading(true);
      setError(null);
      try {
        const attachment = await api.upload<Attachment>(
          `/api/attachments/neuron/${neuronId}`,
          file
        );
        const downloadUrl = `${API_BASE}/api/attachments/${attachment.id}/download`;
        onUploaded(downloadUrl, attachment);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [neuronId, onUploaded]
  );

  const clearError = useCallback(() => setError(null), []);

  return { upload, uploading, error, clearError };
}

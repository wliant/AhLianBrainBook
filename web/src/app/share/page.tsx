"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/hooks/useSettings";
import {
  buildSharedNeuronContent,
  resolveSharedTitle,
  type SharedFile,
} from "@/lib/share/buildSharedNeuronContent";
import type { Attachment, Neuron } from "@/types";

const SHARE_CACHE = "share-inbox";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface SharePayload {
  title: string;
  text: string;
  url: string;
  files: Array<{ file: File; name: string; type: string }>;
}

type Stage =
  | { kind: "loading-payload" }
  | { kind: "creating-neuron" }
  | { kind: "uploading"; current: number; total: number }
  | { kind: "saving-content" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string };

async function readPayloadFromCache(token: string): Promise<SharePayload | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open(SHARE_CACHE);
  const metaResp = await cache.match(new Request(`/__share-inbox/${token}/meta`));
  if (!metaResp) return null;
  const meta = (await metaResp.json()) as { title?: string; text?: string; url?: string; fileCount?: number };
  const fileCount = meta.fileCount || 0;
  const files: SharePayload["files"] = [];
  for (let i = 0; i < fileCount; i++) {
    const fileResp = await cache.match(new Request(`/__share-inbox/${token}/file/${i}`));
    if (!fileResp) continue;
    const blob = await fileResp.blob();
    const name = decodeURIComponent(fileResp.headers.get("x-filename") || `file-${i}`);
    const type = fileResp.headers.get("x-content-type") || blob.type || "application/octet-stream";
    const file = new File([blob], name, { type });
    files.push({ file, name, type });
  }
  return {
    title: meta.title || "",
    text: meta.text || "",
    url: meta.url || "",
    files,
  };
}

async function evictPayload(token: string): Promise<void> {
  if (typeof caches === "undefined") return;
  const cache = await caches.open(SHARE_CACHE);
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((k) => new URL(k.url).pathname.startsWith(`/__share-inbox/${token}/`))
      .map((k) => cache.delete(k)),
  );
}

function readQueryParamsFallback(searchParams: URLSearchParams): SharePayload | null {
  const title = searchParams.get("title") || "";
  const text = searchParams.get("text") || "";
  const url = searchParams.get("url") || "";
  if (!title && !text && !url) return null;
  return { title, text, url, files: [] };
}

function ShareLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, loading: settingsLoading } = useSettings();
  const [stage, setStage] = useState<Stage>({ kind: "loading-payload" });
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = searchParams.get("token");
      let p: SharePayload | null = null;
      if (token) {
        p = await readPayloadFromCache(token);
      }
      if (!p) {
        p = readQueryParamsFallback(searchParams);
      }
      if (cancelled) return;
      if (!p) {
        setStage({ kind: "error", message: "No shared content found." });
        return;
      }
      setPayload(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (settingsLoading || !payload) return;
    if (startedRef.current) return;

    if (!settings?.defaultShareClusterId || !settings?.defaultShareBrainId) {
      router.replace("/settings?from=share");
      return;
    }

    startedRef.current = true;
    void runShare(payload, settings.defaultShareBrainId, settings.defaultShareClusterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, settings, settingsLoading]);

  async function runShare(p: SharePayload, brainId: string, clusterId: string) {
    try {
      const provisionalTitle = resolveSharedTitle({
        title: p.title,
        url: p.url,
        text: p.text,
        files: p.files.map((f) => ({
          attachmentId: "",
          downloadUrl: "",
          fileName: f.name,
          contentType: f.type,
        })),
      });

      setStage({ kind: "creating-neuron" });
      const neuron = await api.post<Neuron>("/api/neurons", {
        title: provisionalTitle,
        brainId,
        clusterId,
      });

      const uploaded: SharedFile[] = [];
      if (p.files.length > 0) {
        setStage({ kind: "uploading", current: 0, total: p.files.length });
        for (let i = 0; i < p.files.length; i++) {
          const f = p.files[i];
          const att = await api.upload<Attachment>(
            `/api/attachments/neuron/${neuron.id}`,
            f.file,
          );
          uploaded.push({
            attachmentId: att.id,
            downloadUrl: `${API_BASE}/api/attachments/${att.id}/download`,
            fileName: att.fileName,
            contentType: att.contentType || f.type,
          });
          setStage({ kind: "uploading", current: i + 1, total: p.files.length });
        }
      }

      setStage({ kind: "saving-content" });
      const { contentJson, contentText } = buildSharedNeuronContent({
        url: p.url || undefined,
        text: p.text || undefined,
        files: uploaded,
      });
      await api.put<Neuron>(`/api/neurons/${neuron.id}/content`, {
        contentJson,
        contentText,
        clientVersion: neuron.version,
      });

      const token = searchParams.get("token");
      if (token) {
        await evictPayload(token);
      }

      setStage({ kind: "redirecting" });
      router.replace(`/brain/${brainId}/cluster/${clusterId}/neuron/${neuron.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStage({ kind: "error", message });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="max-w-md w-full">
        <h1 className="text-xl font-semibold mb-4">Sharing to BrainBook</h1>
        <StageView
          stage={stage}
          onRetry={() => {
            startedRef.current = false;
            if (payload && settings?.defaultShareBrainId && settings?.defaultShareClusterId) {
              startedRef.current = true;
              void runShare(payload, settings.defaultShareBrainId, settings.defaultShareClusterId);
            }
          }}
        />
      </div>
    </div>
  );
}

function StageView({ stage, onRetry }: { stage: Stage; onRetry: () => void }) {
  switch (stage.kind) {
    case "loading-payload":
      return <StatusRow label="Loading shared content…" />;
    case "creating-neuron":
      return <StatusRow label="Creating neuron…" />;
    case "uploading":
      return <StatusRow label={`Uploading file ${stage.current} of ${stage.total}…`} />;
    case "saving-content":
      return <StatusRow label="Saving content…" />;
    case "redirecting":
      return <StatusRow label="Opening neuron…" />;
    case "error":
      return (
        <div className="space-y-3">
          <p className="text-sm text-destructive" data-testid="share-error">{stage.message}</p>
          <button
            onClick={onRetry}
            className="h-9 rounded-md border border-input bg-background px-4 text-sm hover:bg-accent"
          >
            Retry
          </button>
        </div>
      );
  }
}

function StatusRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ShareLanding />
    </Suspense>
  );
}

"use client";

import { use, useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import type { Brain, Cluster, Neuron, NeuronRevision, SectionsDocument } from "@/types";
import { CheckCircle, AlertCircle, Loader2, Star, Pin, Eye, Pencil, Link2, Bell, History, Download, List, GraduationCap, Share2 } from "lucide-react";
import { SectionList } from "@/components/sections/SectionList";
import { normalizeContent, extractPlainText } from "@/components/sections/sectionUtils";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ConnectionsPanel } from "@/components/neuron/ConnectionsPanel";
import { HistoryPanel } from "@/components/neuron/HistoryPanel";
import { TableOfContents } from "@/components/neuron/TableOfContents";
import { EntityMetadata } from "@/components/shared/EntityMetadata";
import { ReminderPanel } from "@/components/neuron/ReminderPanel";
import { SpacedRepetitionPanel } from "@/components/neuron/SpacedRepetitionPanel";
import { ShareDialog } from "@/components/neuron/ShareDialog";
import { useSpacedRepetition } from "@/lib/hooks/useSpacedRepetition";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function NeuronPageContent({
  brainId,
  clusterId,
  neuronId,
}: {
  brainId: string;
  clusterId: string;
  neuronId: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const viewMode = searchParams.get("mode") === "view";
  const queryClient = useQueryClient();

  const [neuron, setNeuron] = useState<Neuron | null>(null);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sectionsDoc, setSectionsDoc] = useState<SectionsDocument | null>(null);
  const [breadcrumbItems, setBreadcrumbItems] = useState<{ label: string; href: string }[]>([]);
  const [showLinks, setShowLinks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [viewingRevision, setViewingRevision] = useState<NeuronRevision | null>(null);
  const [viewingRevisionDoc, setViewingRevisionDoc] = useState<SectionsDocument | null>(null);
  const [hasReminder, setHasReminder] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [showSR, setShowSR] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const { isInReview, addToReview, removeFromReview } = useSpacedRepetition();
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const versionRef = useRef(1);
  const latestDoc = useRef<SectionsDocument>({ version: 2, sections: [] });
  const richTextTextsRef = useRef<Map<string, string>>(new Map());
  const viewRevisionTextsRef = useRef<Map<string, string>>(new Map());
  const titleRef = useRef("");

  useEffect(() => {
    api.get<Neuron>(`/api/neurons/${neuronId}`).then((n) => {
      const parsedJson =
        typeof n.contentJson === "string"
          ? JSON.parse(n.contentJson)
          : n.contentJson;
      const parsed = { ...n, contentJson: parsedJson };
      setNeuron(parsed);
      setTitle(parsed.title);
      titleRef.current = parsed.title;
      versionRef.current = parsed.version;
      const doc = normalizeContent(parsedJson);
      setSectionsDoc(doc);
      latestDoc.current = doc;
    }).catch(() => {
      setLoadError("Neuron not found or failed to load.");
    });
    api.reminders
      .list(neuronId)
      .then((list) => setHasReminder(list.length > 0))
      .catch(() => setHasReminder(false));
    Promise.all([
      api.get<Brain>(`/api/brains/${brainId}`),
      api.get<Cluster>(`/api/clusters/${clusterId}`),
    ]).then(([brain, cluster]) => {
      setBreadcrumbItems([
        { label: brain.name, href: `/brain/${brainId}` },
        { label: cluster.name, href: `/brain/${brainId}/cluster/${clusterId}` },
      ]);
    }).catch(() => {
      setLoadError("Brain or cluster not found.");
    });
  }, [neuronId, brainId, clusterId]);

  const toggleViewMode = () => {
    const hash = window.location.hash;
    if (viewMode) {
      router.replace(pathname + hash);
    } else {
      router.replace(pathname + "?mode=view" + hash);
    }
  };

  const saveContent = useCallback(
    async (newTitle: string) => {
      setSaveStatus("saving");
      try {
        const doc = latestDoc.current;
        const textParts = doc.sections.map((s) => {
          if (s.type === "rich-text") {
            return richTextTextsRef.current.get(s.id) || "";
          }
          return extractPlainText([s]);
        });
        const contentText = textParts.filter(Boolean).join("\n");

        await api.put(`/api/neurons/${neuronId}/content`, {
          contentJson: JSON.stringify(doc),
          contentText,
          clientVersion: versionRef.current,
        });
        if (newTitle !== neuron?.title) {
          await api.patch(`/api/neurons/${neuronId}`, { title: newTitle });
          queryClient.invalidateQueries({ queryKey: ["neurons", clusterId] });
        }
        versionRef.current += 1;
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [neuronId, neuron?.title, clusterId, queryClient]
  );

  const debouncedSave = useCallback(
    (newTitle: string) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => saveContent(newTitle), 1500);
    },
    [saveContent]
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    titleRef.current = e.target.value;
    debouncedSave(e.target.value);
  };

  const handleDocumentChange = useCallback(
    (doc: SectionsDocument) => {
      latestDoc.current = doc;
      setSectionsDoc(doc);
      debouncedSave(titleRef.current);
    },
    [debouncedSave]
  );

  const toggleFavorite = async () => {
    await api.post(`/api/neurons/${neuronId}/favorite`);
    setNeuron((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : prev));
  };

  const togglePin = async () => {
    await api.post(`/api/neurons/${neuronId}/pin`);
    setNeuron((prev) => (prev ? { ...prev, isPinned: !prev.isPinned } : prev));
  };

  const toggleLinks = () => {
    setShowLinks((prev) => {
      if (!prev) { setShowHistory(false); setShowToc(false); setShowReminder(false); setShowSR(false); }
      return !prev;
    });
  };

  const toggleHistory = () => {
    setShowHistory((prev) => {
      if (!prev) {
        setShowLinks(false);
        setShowToc(false);
        setShowReminder(false);
        setShowSR(false);
      } else {
        setViewingRevision(null);
        setViewingRevisionDoc(null);
      }
      return !prev;
    });
  };

  const toggleToc = useCallback(() => {
    setShowToc((prev) => {
      if (!prev) { setShowLinks(false); setShowHistory(false); setShowReminder(false); setShowSR(false); }
      return !prev;
    });
  }, []);

  const toggleReminder = () => {
    setShowReminder((prev) => {
      if (!prev) { setShowLinks(false); setShowHistory(false); setShowToc(false); setShowSR(false); }
      return !prev;
    });
  };

  const toggleSR = () => {
    setShowSR((prev) => {
      if (!prev) { setShowLinks(false); setShowHistory(false); setShowToc(false); setShowReminder(false); }
      return !prev;
    });
  };

  const saveContentRef = useRef(saveContent);
  useEffect(() => { saveContentRef.current = saveContent; }, [saveContent]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveContentRef.current(titleRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = () => toggleToc();
    window.addEventListener("toggle-toc", handler);
    return () => window.removeEventListener("toggle-toc", handler);
  }, [toggleToc]);

  const closeHistory = () => {
    setShowHistory(false);
    setViewingRevision(null);
    setViewingRevisionDoc(null);
  };

  const handleViewRevision = (revision: NeuronRevision) => {
    setViewingRevision(revision);
    const parsed =
      typeof revision.contentJson === "string"
        ? JSON.parse(revision.contentJson)
        : revision.contentJson;
    setViewingRevisionDoc(normalizeContent(parsed));
  };

  const handleRestore = async (revision: NeuronRevision) => {
    const restored = await api.revisions.restore(revision.id);
    const parsedJson =
      typeof restored.contentJson === "string"
        ? JSON.parse(restored.contentJson as string)
        : restored.contentJson;
    const doc = normalizeContent(parsedJson);
    setNeuron({ ...restored, contentJson: parsedJson });
    setSectionsDoc(doc);
    latestDoc.current = doc;
    versionRef.current = restored.version;
    setViewingRevision(null);
    setViewingRevisionDoc(null);
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3" data-testid="neuron-load-error">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!neuron || !sectionsDoc) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const neuronBreadcrumbs = title
    ? [...breadcrumbItems, { label: title, href: pathname }]
    : breadcrumbItems;

  return (
    <div className="flex flex-col h-full" data-testid="neuron-editor-page">
      <Breadcrumb items={neuronBreadcrumbs} />
      <div className="flex items-center gap-2 border-b px-3 sm:px-6 py-2">
        {!viewMode && <SaveStatusIndicator status={saveStatus} />}
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleViewMode}
          title={viewMode ? "Switch to Edit" : "Switch to View"}
          data-testid="toggle-view-mode"
        >
          {viewMode ? (
            <Pencil className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleFavorite}
          title="Toggle Favorite"
          data-testid="toggle-favorite"
        >
          <Star
            className={cn(
              "h-4 w-4",
              neuron.isFavorite && "fill-yellow-400 text-yellow-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={togglePin}
          title="Toggle Pin"
          data-testid="toggle-pin"
        >
          <Pin
            className={cn(
              "h-4 w-4",
              neuron.isPinned && "fill-blue-400 text-blue-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleReminder}
          title="Set Reminder"
          data-testid="toggle-reminder"
        >
          <Bell
            className={cn(
              "h-4 w-4",
              hasReminder && "fill-orange-400 text-orange-400",
              showReminder && !hasReminder && "text-blue-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleSR}
          title="Spaced Repetition"
          data-testid="toggle-sr"
        >
          <GraduationCap
            className={cn(
              "h-4 w-4",
              isInReview(neuronId) && "fill-purple-400 text-purple-400",
              showSR && !isInReview(neuronId) && "text-blue-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleHistory}
          title="Toggle History"
          data-testid="toggle-history"
        >
          <History
            className={cn(
              "h-4 w-4",
              showHistory && "text-blue-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleToc}
          title="Toggle Table of Contents"
          data-testid="toggle-toc"
        >
          <List
            className={cn(
              "h-4 w-4",
              showToc && "text-blue-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={toggleLinks}
          title="Toggle Connections"
          data-testid="toggle-connections"
        >
          <Link2
            className={cn(
              "h-4 w-4",
              showLinks && "text-blue-400"
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setShareDialogOpen(true)}
          title="Share"
          data-testid="toggle-share"
        >
          <Share2 className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Export">
              <Download className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
              window.open(`${API_BASE}/api/neurons/${neuronId}/export/markdown`, "_blank");
            }}>
              Export as Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.print()}>
              Export as PDF (Print)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-auto p-4 sm:p-6 max-w-4xl mx-auto w-full">
          {viewingRevision && viewingRevisionDoc ? (
            <>
              <button
                onClick={() => { setViewingRevision(null); setViewingRevisionDoc(null); }}
                className="w-full mb-4 px-3 py-2 text-sm bg-muted rounded-md text-muted-foreground hover:bg-muted/80 text-left"
                data-testid="revision-banner"
              >
                Viewing revision #{viewingRevision.revisionNumber} — click to dismiss
              </button>
              <h1 className="text-3xl font-bold mb-4">{viewingRevision.title || "Untitled"}</h1>
              <SectionList
                document={viewingRevisionDoc}
                onDocumentChange={() => {}}
                richTextTextsRef={viewRevisionTextsRef}
                neuronId={neuronId}
                viewMode={true}
              />
            </>
          ) : (
            <>
              <div className="mb-4">
                <EntityMetadata
                  createdBy={neuron.createdBy}
                  createdAt={neuron.createdAt}
                  lastUpdatedBy={neuron.lastUpdatedBy}
                  updatedAt={neuron.updatedAt}
                />
              </div>
              {viewMode ? (
                <h1 className="text-3xl font-bold mb-4">{title || "Untitled"}</h1>
              ) : (
                <input
                  type="text"
                  value={title}
                  onChange={handleTitleChange}
                  placeholder="Untitled"
                  className="w-full text-3xl font-bold border-none outline-none mb-4 bg-transparent"
                  data-testid="neuron-title-input"
                />
              )}
              <SectionList
                document={sectionsDoc}
                onDocumentChange={handleDocumentChange}
                richTextTextsRef={richTextTextsRef}
                neuronId={neuronId}
                brainId={brainId}
                viewMode={viewMode}
              />
            </>
          )}
        </div>
        {showToc && sectionsDoc && (
          <div className="fixed inset-x-0 bottom-0 h-[60vh] z-30 border-t bg-background overscroll-contain lg:relative lg:inset-auto lg:h-auto lg:z-auto lg:border-t-0">
            <TableOfContents
              document={sectionsDoc}
              onClose={() => setShowToc(false)}
            />
          </div>
        )}
        {showLinks && (
          <div className="fixed inset-x-0 bottom-0 h-[60vh] z-30 border-t bg-background overscroll-contain lg:relative lg:inset-auto lg:h-auto lg:z-auto lg:border-t-0">
            <ConnectionsPanel
              neuronId={neuronId}
              brainId={brainId}
              onClose={() => setShowLinks(false)}
            />
          </div>
        )}
        {showHistory && (
          <div className="fixed inset-x-0 bottom-0 h-[60vh] z-30 border-t bg-background overscroll-contain lg:relative lg:inset-auto lg:h-auto lg:z-auto lg:border-t-0">
            <HistoryPanel
              neuronId={neuronId}
              onClose={closeHistory}
              onViewRevision={handleViewRevision}
              onRestore={handleRestore}
            />
          </div>
        )}
        {showReminder && (
          <div className="fixed inset-x-0 bottom-0 h-[60vh] z-30 border-t bg-background overscroll-contain lg:relative lg:inset-auto lg:h-auto lg:z-auto lg:border-t-0">
            <ReminderPanel
              neuronId={neuronId}
              onClose={() => setShowReminder(false)}
              onReminderChange={setHasReminder}
            />
          </div>
        )}
        {showSR && (
          <div className="fixed inset-x-0 bottom-0 h-[60vh] z-30 border-t bg-background overscroll-contain lg:relative lg:inset-auto lg:h-auto lg:z-auto lg:border-t-0">
            <SpacedRepetitionPanel
              neuronId={neuronId}
              onClose={() => setShowSR(false)}
              addToReview={addToReview}
              removeFromReview={removeFromReview}
            />
          </div>
        )}
      </div>
      <ShareDialog
        neuronId={neuronId}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />
    </div>
  );
}

export default function NeuronPage({
  params,
}: {
  params: Promise<{ brainId: string; clusterId: string; neuronId: string }>;
}) {
  const { brainId, clusterId, neuronId } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <NeuronPageContent brainId={brainId} clusterId={clusterId} neuronId={neuronId} />
    </Suspense>
  );
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="save-status">
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle className="h-3 w-3 text-green-500" />
          <span>Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span>Save failed</span>
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Copy, Trash2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useNeuronShares } from "@/lib/hooks/useNeuronShares";

const EXPIRY_OPTIONS = [
  { label: "1 hour", value: 1 },
  { label: "24 hours", value: 24 },
  { label: "7 days", value: 168 },
  { label: "30 days", value: 720 },
  { label: "Never", value: null },
] as const;

interface ShareDialogProps {
  neuronId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ neuronId, open, onOpenChange }: ShareDialogProps) {
  const { shares, loading, createShare, revokeShare } = useNeuronShares(neuronId);
  const [creating, setCreating] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState<number | null>(168);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createShare(selectedExpiry);
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (token: string, shareId: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (shareId: string) => {
    await revokeShare(shareId);
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return "Never expires";
    const date = new Date(expiresAt);
    if (date < new Date()) return "Expired";
    return `Expires ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Neuron</DialogTitle>
          <DialogDescription>
            Generate a read-only share link for this neuron.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select
              value={selectedExpiry ?? ""}
              onChange={(e) => setSelectedExpiry(e.target.value ? Number(e.target.value) : null)}
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              data-testid="expiry-select"
            >
              {EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value ?? ""}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button onClick={handleCreate} disabled={creating} data-testid="create-share-btn">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate Link"}
            </Button>
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && shares.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Active share links</p>
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  data-testid={`share-row-${share.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate">{share.token.slice(0, 16)}...</p>
                    <p className="text-xs text-muted-foreground">{formatExpiry(share.expiresAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => handleCopy(share.token, share.id)}
                    title="Copy link"
                  >
                    {copiedId === share.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleRevoke(share.id)}
                    title="Revoke link"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!loading && shares.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No active share links
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

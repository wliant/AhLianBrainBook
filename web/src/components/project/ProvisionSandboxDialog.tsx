"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProvisionSandboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoUrl: string;
  defaultBranch: string | null;
  onProvision: (body: { branch: string; shallow: boolean }) => Promise<void>;
}

export function ProvisionSandboxDialog({
  open,
  onOpenChange,
  repoUrl,
  defaultBranch,
  onProvision,
}: ProvisionSandboxDialogProps) {
  const [branch, setBranch] = useState(defaultBranch || "main");
  const [shallow, setShallow] = useState(true);
  const [provisioning, setProvisioning] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (provisioning) return;

    setProvisioning(true);
    try {
      await onProvision({ branch, shallow });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to provision sandbox:", err);
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provision Sandbox</DialogTitle>
          <DialogDescription>
            Clone the repository to the server for full git operations, code
            search, and automatic anchor reconciliation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Repository
              </label>
              <p className="text-sm font-mono truncate">{repoUrl}</p>
            </div>

            <div>
              <label htmlFor="sandbox-branch" className="text-sm font-medium">
                Branch
              </label>
              <Input
                id="sandbox-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sandbox-shallow"
                checked={shallow}
                onChange={(e) => setShallow(e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="sandbox-shallow" className="text-sm">
                Shallow clone (faster, less disk space)
              </label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={provisioning || !branch.trim()}>
              {provisioning ? "Provisioning..." : "Provision"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

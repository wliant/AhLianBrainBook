"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeleteThoughtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thoughtName: string;
  onConfirm: () => Promise<void>;
}

export function DeleteThoughtDialog({
  open,
  onOpenChange,
  thoughtName,
  onConfirm,
}: DeleteThoughtDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="delete-thought-dialog">
        <DialogHeader>
          <DialogTitle>Delete Thought</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{thoughtName}&quot;? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            data-testid="confirm-delete-thought"
            variant="default"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

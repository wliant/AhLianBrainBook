"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface GoToLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGoToLine: (line: number) => void;
  maxLine?: number;
}

export function GoToLineDialog({ open, onOpenChange, onGoToLine, maxLine }: GoToLineDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  const handleSubmit = useCallback(() => {
    const line = parseInt(value);
    if (isNaN(line) || line < 1) return;
    if (maxLine && line > maxLine) return;
    onGoToLine(line);
    onOpenChange(false);
  }, [value, maxLine, onGoToLine, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xs" aria-describedby={undefined}>
        <div className="p-3">
          <input
            type="number"
            min={1}
            max={maxLine}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Go to line${maxLine ? ` (1–${maxLine})` : ""}...`}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

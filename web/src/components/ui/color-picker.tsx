"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6",
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#78716c", "#0ea5e9",
];

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState("");

  const handleSelect = (color: string) => {
    onChange(color);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const applyHex = () => {
    const hex = hexInput.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(hex)) {
      onChange(`#${hex}`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setHexInput(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-7 w-7 rounded-full border-2 shrink-0 transition-colors hover:ring-2 hover:ring-ring hover:ring-offset-1",
            !value && "border-dashed border-muted-foreground/40",
            value && "border-transparent",
            className
          )}
          style={value ? { backgroundColor: value } : undefined}
          aria-label="Pick color"
        />
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-52 p-3", className)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Color</span>
          {value && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
              onClick={handleClear}
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        <div className="grid grid-cols-6 gap-1.5 mb-3">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="h-7 w-7 rounded-full border border-border flex items-center justify-center hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              onClick={() => handleSelect(color)}
              aria-label={color}
            >
              {value === color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">#</span>
          <Input
            placeholder="hex"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") applyHex();
            }}
            className="h-7 text-xs flex-1"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

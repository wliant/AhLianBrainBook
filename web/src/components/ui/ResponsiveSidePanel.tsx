"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveSidePanelProps {
  open: boolean;
  onDismiss?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function ResponsiveSidePanel({
  open,
  onDismiss,
  className,
  children,
}: ResponsiveSidePanelProps) {
  if (!open) return null;

  return (
    <>
      {onDismiss && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={onDismiss}
          aria-hidden
        />
      )}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 h-[70dvh] z-30 border-t bg-background overscroll-contain lg:relative lg:inset-auto lg:h-auto lg:z-auto lg:w-80 lg:border-t-0 lg:border-l lg:shrink-0",
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

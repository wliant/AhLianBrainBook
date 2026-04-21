"use client";

import { useState, useCallback, useRef } from "react";

export function useResizeHandle(
  initialSize: number,
  min: number,
  max: number,
  direction: "left" | "right" = "left",
  enabled: boolean = true
) {
  const [size, setSize] = useState(initialSize);
  const isResizing = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      e.preventDefault();
      isResizing.current = true;
      const startX = e.clientX;
      const startSize = size;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = ev.clientX - startX;
        const newSize = Math.max(min, Math.min(max, startSize + (direction === "left" ? delta : -delta)));
        setSize(newSize);
      };

      const onMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [size, min, max, direction, enabled]
  );

  return { size, handleMouseDown };
}

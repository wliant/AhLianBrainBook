"use client";

import { X } from "lucide-react";
import type { ExecutionResult } from "@/lib/sandbox/types";

interface CodeRunnerProps {
  result: ExecutionResult;
  onClear: () => void;
}

export function CodeRunner({ result, onClear }: CodeRunnerProps) {
  return (
    <div className="border-t bg-[#1e1e1e] text-sm font-mono" data-testid="code-runner-output">
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#333]">
        <span className="text-[11px] text-gray-400">
          Output — {result.duration}ms
        </span>
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-gray-200 p-0.5"
          title="Clear output"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="px-3 py-2 max-h-60 overflow-y-auto whitespace-pre-wrap break-all text-[13px] leading-5">
        {result.stdout && (
          <div className="text-gray-200">{result.stdout}</div>
        )}
        {result.stderr && (
          <div className="text-red-400">{result.stderr}</div>
        )}
        {result.error && (
          <div className="text-red-400">Error: {result.error}</div>
        )}
        {!result.stdout && !result.stderr && !result.error && (
          <div className="text-gray-500 italic">No output</div>
        )}
      </div>
    </div>
  );
}

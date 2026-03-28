"use client";

import { useCallback } from "react";
import type { Section } from "@/types";
import { Plus, Trash2 } from "lucide-react";

interface TableSectionProps {
  section: Section;
  onUpdate: (content: Record<string, unknown>) => void;
}

export function TableSection({ section, onUpdate }: TableSectionProps) {
  const headers = (section.content.headers as string[]) || ["Column 1"];
  const rows = (section.content.rows as string[][]) || [[""]];

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      const newRows = rows.map((row, ri) =>
        ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : [...row]
      );
      onUpdate({ headers, rows: newRows });
    },
    [headers, rows, onUpdate]
  );

  const updateHeader = useCallback(
    (colIdx: number, value: string) => {
      const newHeaders = headers.map((h, i) => (i === colIdx ? value : h));
      onUpdate({ headers: newHeaders, rows });
    },
    [headers, rows, onUpdate]
  );

  const addColumn = useCallback(() => {
    onUpdate({
      headers: [...headers, `Column ${headers.length + 1}`],
      rows: rows.map((row) => [...row, ""]),
    });
  }, [headers, rows, onUpdate]);

  const addRow = useCallback(() => {
    onUpdate({
      headers,
      rows: [...rows, new Array(headers.length).fill("")],
    });
  }, [headers, rows, onUpdate]);

  const removeColumn = useCallback(
    (colIdx: number) => {
      if (headers.length <= 1) return;
      onUpdate({
        headers: headers.filter((_, i) => i !== colIdx),
        rows: rows.map((row) => row.filter((_, i) => i !== colIdx)),
      });
    },
    [headers, rows, onUpdate]
  );

  const removeRow = useCallback(
    (rowIdx: number) => {
      if (rows.length <= 1) return;
      onUpdate({
        headers,
        rows: rows.filter((_, i) => i !== rowIdx),
      });
    },
    [headers, rows, onUpdate]
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {headers.map((header, colIdx) => (
                <th key={colIdx} className="border-b border-r last:border-r-0 p-0">
                  <div className="flex items-center">
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => updateHeader(colIdx, e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none font-medium text-left"
                    />
                    {headers.length > 1 && (
                      <button
                        onClick={() => removeColumn(colIdx)}
                        className="p-1 text-muted-foreground hover:text-destructive opacity-0 hover:opacity-100 focus:opacity-100"
                        title="Remove column"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="border-b w-8 p-0">
                <button
                  onClick={addColumn}
                  className="p-1.5 text-muted-foreground hover:text-foreground w-full"
                  title="Add column"
                >
                  <Plus className="h-3 w-3 mx-auto" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group">
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="border-b border-r last:border-r-0 p-0">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent outline-none"
                    />
                  </td>
                ))}
                <td className="border-b w-8 p-0">
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(rowIdx)}
                      className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                      title="Remove row"
                    >
                      <Trash2 className="h-3 w-3 mx-auto" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        + Add row
      </button>
    </div>
  );
}

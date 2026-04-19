import { describe, it, expect } from "vitest";
import { sortTasksForOverview } from "@/lib/taskSort";
import type { TaskOverviewItem, TodoEffort, TodoPriority } from "@/types";

function task(overrides: Partial<TaskOverviewItem> & { neuronId: string }): TaskOverviewItem {
  return {
    neuronId: overrides.neuronId,
    title: overrides.title ?? overrides.neuronId,
    dueDate: overrides.dueDate ?? null,
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    effort: (overrides.effort as TodoEffort | null | undefined) ?? null,
    priority: (overrides.priority as TodoPriority | undefined) ?? "normal",
    brainId: overrides.brainId ?? "b1",
    brainName: overrides.brainName ?? "Brain",
    brainColor: overrides.brainColor ?? null,
    brainIcon: overrides.brainIcon ?? null,
    clusterId: overrides.clusterId ?? "c1",
    clusterName: overrides.clusterName ?? "Cluster",
    createdAt: overrides.createdAt ?? "2026-04-01T00:00:00",
    updatedAt: overrides.updatedAt ?? "2026-04-01T00:00:00",
  };
}

describe("sortTasksForOverview", () => {
  const NOW = new Date(2026, 3, 19, 12, 0, 0); // 2026-04-19 local
  // today = 2026-04-19, yesterday = 2026-04-18

  it("orders by due date ascending with null last", () => {
    const items = [
      task({ neuronId: "none", dueDate: null }),
      task({ neuronId: "later", dueDate: "2026-05-01" }),
      task({ neuronId: "today", dueDate: "2026-04-19" }),
      task({ neuronId: "tomorrow", dueDate: "2026-04-20" }),
    ];
    const sorted = sortTasksForOverview(items, NOW).map((t) => t.neuronId);
    expect(sorted).toEqual(["today", "tomorrow", "later", "none"]);
  });

  it("places overdue tasks before today, collapsed to yesterday", () => {
    const items = [
      task({ neuronId: "today", dueDate: "2026-04-19" }),
      task({ neuronId: "overdue-week", dueDate: "2026-04-12" }),
      task({ neuronId: "overdue-yesterday", dueDate: "2026-04-18" }),
    ];
    const sorted = sortTasksForOverview(items, NOW).map((t) => t.neuronId);
    // Both overdue items collapse to "yesterday" and come first; within that tier
    // priority and effort are tiebreakers so ordering between them is stable.
    expect(sorted[0]).toMatch(/^overdue-/);
    expect(sorted[1]).toMatch(/^overdue-/);
    expect(sorted[2]).toBe("today");
  });

  it("breaks due-date ties by priority then effort", () => {
    const items = [
      task({ neuronId: "normal-short", dueDate: "2026-04-19", priority: "normal", effort: "15min" }),
      task({ neuronId: "critical-long", dueDate: "2026-04-19", priority: "critical", effort: "8hr" }),
      task({ neuronId: "important-short", dueDate: "2026-04-19", priority: "important", effort: "15min" }),
      task({ neuronId: "important-long", dueDate: "2026-04-19", priority: "important", effort: "2hr" }),
    ];
    const sorted = sortTasksForOverview(items, NOW).map((t) => t.neuronId);
    expect(sorted).toEqual([
      "critical-long",
      "important-short",
      "important-long",
      "normal-short",
    ]);
  });

  it("breaks ties with tasks missing effort by placing them after those with effort", () => {
    const items = [
      task({ neuronId: "no-effort", dueDate: "2026-04-19", priority: "normal" }),
      task({ neuronId: "with-effort", dueDate: "2026-04-19", priority: "normal", effort: "4hr" }),
    ];
    const sorted = sortTasksForOverview(items, NOW).map((t) => t.neuronId);
    expect(sorted).toEqual(["with-effort", "no-effort"]);
  });

  it("puts completed tasks after incomplete regardless of date", () => {
    const items = [
      task({ neuronId: "done-today", dueDate: "2026-04-19", completed: true }),
      task({ neuronId: "no-due-active", dueDate: null }),
    ];
    const sorted = sortTasksForOverview(items, NOW).map((t) => t.neuronId);
    expect(sorted).toEqual(["no-due-active", "done-today"]);
  });

  it("returns a new array without mutating the input", () => {
    const items = [task({ neuronId: "a", dueDate: "2026-05-01" }), task({ neuronId: "b", dueDate: "2026-04-20" })];
    const original = [...items];
    const sorted = sortTasksForOverview(items, NOW);
    expect(items).toEqual(original);
    expect(sorted).not.toBe(items);
  });
});

import type { TaskOverviewItem, TodoEffort, TodoPriority } from "@/types";

const PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  critical: 0,
  important: 1,
  normal: 2,
};

const EFFORT_WEIGHT: Record<TodoEffort, number> = {
  "15min": 0,
  "30min": 1,
  "1hr": 2,
  "2hr": 3,
  "4hr": 4,
  "8hr": 5,
};

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Due date ordering with overdue collapsed to "yesterday" and null ranked last.
function effectiveDueKey(dueDate: string | null, todayIso: string, yesterdayIso: string): string {
  if (!dueDate) return "9999-12-31";
  if (dueDate < todayIso) return yesterdayIso;
  return dueDate;
}

export function sortTasksForOverview(tasks: TaskOverviewItem[], now: Date = new Date()): TaskOverviewItem[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayIso = toLocalIso(today);
  const yesterdayIso = toLocalIso(yesterday);

  return [...tasks].sort((a, b) => {
    // Incomplete first, completed last.
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    const keyA = effectiveDueKey(a.dueDate, todayIso, yesterdayIso);
    const keyB = effectiveDueKey(b.dueDate, todayIso, yesterdayIso);
    if (keyA !== keyB) return keyA.localeCompare(keyB);

    const prA = PRIORITY_WEIGHT[a.priority];
    const prB = PRIORITY_WEIGHT[b.priority];
    if (prA !== prB) return prA - prB;

    const efA = a.effort ? EFFORT_WEIGHT[a.effort] : Number.MAX_SAFE_INTEGER;
    const efB = b.effort ? EFFORT_WEIGHT[b.effort] : Number.MAX_SAFE_INTEGER;
    return efA - efB;
  });
}

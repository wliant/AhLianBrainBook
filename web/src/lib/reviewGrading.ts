import type { ReviewQuestion } from "@/types";

/** What the user has selected for a choice question, keyed by question id. */
export type ChoiceSelections = Record<string, string[]>;

export type QuestionVerdict = "correct" | "incorrect" | "ungraded";

/**
 * A question is gradable only when it declares a choice type AND actually carries options.
 * A malformed or legacy row therefore renders as free text rather than an empty radio group.
 */
export function isChoiceQuestion(q: ReviewQuestion): boolean {
  const type = q.questionType;
  if (type !== "SINGLE_CHOICE" && type !== "MULTI_CHOICE") return false;
  return Array.isArray(q.choices) && q.choices.length > 0;
}

export function isMultiSelect(q: ReviewQuestion): boolean {
  return q.questionType === "MULTI_CHOICE";
}

export function correctIds(q: ReviewQuestion): string[] {
  return (q.choices ?? []).filter((c) => c.correct).map((c) => c.id);
}

/**
 * Exact set match: a multi-select answer is correct only if the selected set equals the
 * correct set. No partial credit — a subset or a superset is simply wrong.
 */
export function gradeQuestion(q: ReviewQuestion, selected: string[] | undefined): QuestionVerdict {
  if (!isChoiceQuestion(q)) return "ungraded";
  const expected = correctIds(q);
  const actual = Array.from(new Set(selected ?? []));
  if (actual.length !== expected.length) return "incorrect";
  const expectedSet = new Set(expected);
  return actual.every((id) => expectedSet.has(id)) ? "correct" : "incorrect";
}

export interface QuizScore {
  /** Choice questions, which are machine-graded. */
  gradedCount: number;
  correctCount: number;
  /** Free-text questions, which the reviewer grades themselves. */
  selfAssessedCount: number;
  /** Fraction of graded questions answered correctly; 0 when nothing is gradable. */
  ratio: number;
}

export function gradeQuiz(questions: ReviewQuestion[], selections: ChoiceSelections): QuizScore {
  let gradedCount = 0;
  let correctCount = 0;
  let selfAssessedCount = 0;

  for (const q of questions) {
    const verdict = gradeQuestion(q, selections[q.id]);
    if (verdict === "ungraded") {
      selfAssessedCount += 1;
      continue;
    }
    gradedCount += 1;
    if (verdict === "correct") correctCount += 1;
  }

  return {
    gradedCount,
    correctCount,
    selfAssessedCount,
    ratio: gradedCount === 0 ? 0 : correctCount / gradedCount,
  };
}

/**
 * Maps a score onto the SM-2 quality values the review page offers
 * (Again 1 / Hard 2 / Good 4 / Easy 5). Returns null when nothing was machine-graded,
 * so a free-text-only set gets no suggestion. This only ever highlights a button —
 * the rating stays the reviewer's call.
 */
export function suggestQuality(score: QuizScore): number | null {
  if (score.gradedCount === 0) return null;
  if (score.ratio >= 0.9) return 5;
  if (score.ratio >= 0.7) return 4;
  if (score.ratio >= 0.4) return 2;
  return 1;
}

/** Toggles one option for a multi-select question; replaces the selection for single-select. */
export function applySelection(
  q: ReviewQuestion,
  current: string[] | undefined,
  optionId: string,
): string[] {
  if (!isMultiSelect(q)) return [optionId];
  const selected = current ?? [];
  return selected.includes(optionId)
    ? selected.filter((id) => id !== optionId)
    : [...selected, optionId];
}

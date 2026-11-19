"use client";

import type { ReviewQuestion } from "@/types";

interface FreeTextQuestionProps {
  question: ReviewQuestion;
  index: number;
  total: number;
  answer: string;
  revealed: boolean;
  onChange: (value: string) => void;
}

/**
 * Open-recall question, graded by the reviewer. Extracted verbatim from the review page
 * so its test ids (and the existing tests that rely on them) stay unchanged.
 */
export function FreeTextQuestion({
  question,
  index,
  total,
  answer,
  revealed,
  onChange,
}: FreeTextQuestionProps) {
  return (
    <div className="border rounded-md p-4">
      <p className="font-medium text-sm text-muted-foreground mb-1">
        Question {index + 1} of {total}
      </p>
      <p className="text-base">{question.questionText}</p>

      <textarea
        className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground resize-y min-h-[60px]"
        placeholder="Type your answer here..."
        rows={3}
        value={answer}
        onChange={(e) => onChange(e.target.value)}
        disabled={revealed}
        data-testid={`user-answer-${index}`}
      />

      {revealed && (
        <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-3" data-testid={`user-answer-display-${index}`}>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Your Answer</p>
            <p className="text-base whitespace-pre-wrap">{answer || <em className="text-muted-foreground">No answer provided</em>}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/30 rounded p-3" data-testid={`correct-answer-${index}`}>
            <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Correct Answer</p>
            <p className="text-base whitespace-pre-wrap">{question.answerText}</p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Check, X, ExternalLink, Globe } from "lucide-react";
import type { ReviewQuestion } from "@/types";
import { cn } from "@/lib/utils";
import { gradeQuestion, isMultiSelect } from "@/lib/reviewGrading";

interface ChoiceQuestionProps {
  question: ReviewQuestion;
  index: number;
  total: number;
  selected: string[];
  revealed: boolean;
  onToggle: (optionId: string) => void;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function ChoiceQuestion({
  question,
  index,
  total,
  selected,
  revealed,
  onToggle,
}: ChoiceQuestionProps) {
  const multi = isMultiSelect(question);
  const verdict = gradeQuestion(question, selected);
  const options = question.choices ?? [];

  return (
    <div className="border rounded-md p-4" data-testid={`choice-question-${index}`}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <p className="font-medium text-sm text-muted-foreground">
          Question {index + 1} of {total}
        </p>
        <span className="text-xs rounded-full border px-2 py-0.5 text-muted-foreground">
          {multi ? "Select all that apply" : "Select one"}
        </span>
        {question.researched && (
          <span
            className="inline-flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 text-muted-foreground"
            title="Distractors were researched with web search"
            data-testid={`choice-researched-${index}`}
          >
            <Globe className="h-3 w-3" />
            Web-researched
          </span>
        )}
        {revealed && (
          <span
            className={cn(
              "text-xs font-medium rounded-full px-2 py-0.5 ml-auto",
              verdict === "correct"
                ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
            )}
            data-testid={`choice-verdict-${index}`}
          >
            {verdict === "correct" ? "Correct" : "Incorrect"}
          </span>
        )}
      </div>

      <p className="text-base">{question.questionText}</p>

      <div className="mt-3 space-y-2" role={multi ? "group" : "radiogroup"}>
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          // After reveal, show the full key: what was right, and what the user picked.
          const showAsCorrect = revealed && option.correct;
          const showAsWrong = revealed && !option.correct && isSelected;

          return (
            <div key={option.id}>
              <label
                className={cn(
                  "flex items-start gap-3 min-h-[44px] w-full rounded-md border p-3 text-sm",
                  !revealed && "cursor-pointer hover:bg-accent",
                  showAsCorrect && isSelected &&
                    "border-green-500 bg-green-50 dark:bg-green-950/30",
                  showAsCorrect && !isSelected && "border-green-500 border-dashed",
                  showAsWrong && "border-red-500 bg-red-50 dark:bg-red-950/30",
                )}
                data-testid={`choice-option-${index}-${option.id}`}
              >
                <input
                  type={multi ? "checkbox" : "radio"}
                  name={`question-${question.id}`}
                  className="mt-0.5 shrink-0"
                  checked={isSelected}
                  disabled={revealed}
                  onChange={() => onToggle(option.id)}
                  data-testid={`choice-input-${index}-${option.id}`}
                />
                <span className="break-words flex-1">{option.text}</span>
                {showAsCorrect && (
                  <Check className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                )}
                {showAsWrong && <X className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />}
              </label>

              {revealed && (option.rationale || option.sourceUrl) && (
                <div className="mt-1 ml-3 pl-4 border-l text-xs text-muted-foreground space-y-1">
                  {option.rationale && <p className="break-words">{option.rationale}</p>}
                  {option.sourceUrl && (
                    <a
                      href={option.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline break-all"
                      data-testid={`choice-source-${index}-${option.id}`}
                    >
                      {hostnameOf(option.sourceUrl)}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {revealed && question.explanation && (
        <div
          className="mt-3 pt-3 border-t text-sm text-muted-foreground break-words"
          data-testid={`choice-explanation-${index}`}
        >
          {question.explanation}
        </div>
      )}
    </div>
  );
}

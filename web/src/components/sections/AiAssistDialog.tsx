"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAiAssist } from "@/lib/hooks/useAiAssist";
import type {
  AiAssistQuestion,
  AiAssistQuestionAnswer,
  ConversationTurn,
  Section,
  SectionType,
} from "@/types";
import { extractTiptapText } from "./sectionUtils";
import { Loader2, Undo2, RefreshCw, Send } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  "rich-text": "Rich Text",
  code: "Code",
  math: "Math",
  diagram: "Diagram",
  callout: "Callout",
  table: "Table",
};

interface AiAssistDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (content: Record<string, unknown>) => void;
  section: Section;
  neuronId: string;
}

export function AiAssistDialog({
  open,
  onClose,
  onSave,
  section,
  neuronId,
}: AiAssistDialogProps) {
  const {
    conversationHistory,
    currentContent,
    loading,
    error,
    sendMessage,
    regenerate,
    undo,
    canUndo,
    reset,
  } = useAiAssist(neuronId, section.id, section.type, section.content);

  const [inputValue, setInputValue] = useState("");
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string | string[]>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        reset();
        onClose();
      }
    },
    [reset, onClose],
  );

  const handleSend = useCallback(() => {
    const msg = inputValue.trim();
    if (!msg && !loading) return;
    setInputValue("");
    sendMessage(msg);
  }, [inputValue, loading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleSubmitAnswers = useCallback(
    (questions: AiAssistQuestion[]) => {
      const answers: AiAssistQuestionAnswer[] = questions.map((q) => ({
        questionId: q.id,
        value: questionAnswers[q.id] ?? (q.inputType === "multi-select" ? [] : ""),
      }));
      setQuestionAnswers({});
      sendMessage("", answers);
    },
    [questionAnswers, sendMessage],
  );

  const handleSave = useCallback(() => {
    if (currentContent) {
      onSave(currentContent);
    }
    reset();
    onClose();
  }, [currentContent, onSave, reset, onClose]);

  const pendingQuestions = getPendingQuestions(conversationHistory);
  const hasGeneratedContent =
    currentContent !== null && currentContent !== section.content;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-4xl h-[80vh] flex flex-col"
        data-testid="ai-assist-dialog"
      >
        <DialogHeader>
          <DialogTitle>AI Assist — {TYPE_LABELS[section.type] ?? section.type}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
          {/* Left panel: Content Preview */}
          <div className="w-1/2 overflow-auto border rounded-lg p-4 bg-muted/30" data-testid="ai-assist-preview">
            <h3 className="text-xs uppercase text-muted-foreground mb-2 tracking-wider">
              Preview
            </h3>
            {currentContent ? (
              <ContentPreview sectionType={section.type} content={currentContent} />
            ) : (
              <p className="text-sm text-muted-foreground italic">Empty section</p>
            )}
          </div>

          {/* Right panel: Chat */}
          <div className="w-1/2 flex flex-col overflow-hidden" data-testid="ai-assist-chat">
            <div className="flex-1 overflow-auto space-y-3 mb-3 pr-1">
              {conversationHistory.map((turn, i) => (
                <ChatMessage key={i} turn={turn} />
              ))}
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3" data-testid="ai-assist-error">
                  {error}
                </div>
              )}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="ai-assist-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Question form */}
            {pendingQuestions && !loading && (
              <QuestionForm
                questions={pendingQuestions}
                answers={questionAnswers}
                onAnswerChange={setQuestionAnswers}
                onSubmit={() => handleSubmitAnswers(pendingQuestions)}
              />
            )}

            {/* Input */}
            {!pendingQuestions && (
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
                  placeholder="Describe what you need..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  data-testid="ai-assist-input"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !inputValue.trim()}
                  className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  data-testid="ai-assist-send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <button
              onClick={undo}
              disabled={!canUndo || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
              data-testid="ai-assist-undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              onClick={regenerate}
              disabled={!hasGeneratedContent || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-muted disabled:opacity-50"
              data-testid="ai-assist-regenerate"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!hasGeneratedContent || loading}
              className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              data-testid="ai-assist-save"
            >
              Save
            </button>
            <button
              onClick={() => handleOpenChange(false)}
              className="px-4 py-1.5 text-sm border rounded-lg hover:bg-muted"
              data-testid="ai-assist-close"
            >
              Close
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalizeQuestion(q: Record<string, unknown>): AiAssistQuestion {
  return {
    id: (q.id as string) ?? "",
    text: (q.text as string) ?? "",
    inputType: ((q.inputType ?? q.input_type) as AiAssistQuestion["inputType"]) ?? "free-text",
    options: (q.options as string[]) ?? undefined,
    required: (q.required as boolean) ?? true,
  };
}

function getPendingQuestions(history: ConversationTurn[]): AiAssistQuestion[] | null {
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  if (last.role === "assistant" && last.content.type === "questions") {
    return last.content.questions.map((q) => normalizeQuestion(q as unknown as Record<string, unknown>));
  }
  return null;
}

function ChatMessage({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === "user";
  const content = turn.content;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {content.type === "text" && <p>{content.text}</p>}
        {content.type === "questions" && (
          <div>
            <p className="font-medium mb-1">I have some questions:</p>
            {content.questions.map((q) => (
              <p key={q.id} className="ml-2">
                • {q.text}
              </p>
            ))}
          </div>
        )}
        {content.type === "answers" && (
          <div>
            {content.answers.map((a) => (
              <p key={a.questionId}>
                {Array.isArray(a.value) ? a.value.join(", ") : a.value}
              </p>
            ))}
          </div>
        )}
        {content.type === "section_content" && (
          <p className="italic text-muted-foreground">✓ Content generated</p>
        )}
        {content.type === "reply" && <p>{content.text}</p>}
        {content.type === "message" && (
          <p
            className={
              content.severity === "error"
                ? "text-destructive"
                : content.severity === "warning"
                  ? "text-yellow-600 dark:text-yellow-400"
                  : ""
            }
          >
            {content.text}
          </p>
        )}
      </div>
    </div>
  );
}

function ContentPreview({
  sectionType,
  content,
}: {
  sectionType: SectionType;
  content: Record<string, unknown>;
}) {
  switch (sectionType) {
    case "code":
      return (
        <pre className="text-sm font-mono bg-muted p-3 rounded overflow-auto whitespace-pre-wrap">
          <code>{String(content.code ?? "")}</code>
        </pre>
      );
    case "math":
      return <p className="text-sm font-mono">{String(content.latex ?? "")}</p>;
    case "diagram":
      return (
        <pre className="text-sm font-mono bg-muted p-3 rounded overflow-auto whitespace-pre-wrap">
          {String(content.source ?? "")}
        </pre>
      );
    case "callout":
      return (
        <div className="border-l-4 border-blue-500 pl-3 py-1">
          <span className="text-xs uppercase text-muted-foreground">
            {String(content.variant ?? "info")}
          </span>
          <p className="text-sm">{String(content.text ?? "")}</p>
        </div>
      );
    case "table": {
      const headers = (content.headers as string[]) ?? [];
      const rows = (content.rows as string[][]) ?? [];
      return (
        <table className="text-sm border-collapse w-full">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="border px-2 py-1 text-left bg-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border px-2 py-1">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "rich-text": {
      const text = extractTiptapText(content);
      if (!text.trim()) return null;
      return <div className="text-sm whitespace-pre-wrap">{text}</div>;
    }
    default:
      return <p className="text-sm text-muted-foreground">Preview not available</p>;
  }
}

function QuestionForm({
  questions,
  answers,
  onAnswerChange,
  onSubmit,
}: {
  questions: AiAssistQuestion[];
  answers: Record<string, string | string[]>;
  onAnswerChange: (answers: Record<string, string | string[]>) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30" data-testid="ai-assist-questions">
      {questions.map((q) => (
        <div key={q.id}>
          <p className="text-sm font-medium mb-1">{q.text}</p>
          {q.inputType === "single-select" && q.options && (
            <div className="space-y-1">
              {q.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() =>
                      onAnswerChange({ ...answers, [q.id]: opt })
                    }
                    className="accent-primary"
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
          {q.inputType === "multi-select" && q.options && (
            <div className="space-y-1">
              {q.options.map((opt) => {
                const selected = (answers[q.id] as string[] | undefined) ?? [];
                return (
                  <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, opt]
                          : selected.filter((v) => v !== opt);
                        onAnswerChange({ ...answers, [q.id]: next });
                      }}
                      className="accent-primary"
                    />
                    {opt}
                  </label>
                );
              })}
            </div>
          )}
          {q.inputType === "free-text" && (
            <input
              type="text"
              className="w-full border rounded px-2 py-1 text-sm bg-background"
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) =>
                onAnswerChange({ ...answers, [q.id]: e.target.value })
              }
              placeholder="Type your answer..."
            />
          )}
        </div>
      ))}
      <button
        onClick={onSubmit}
        className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        data-testid="ai-assist-submit-answers"
      >
        Submit Answers
      </button>
    </div>
  );
}

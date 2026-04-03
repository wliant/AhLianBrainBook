"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSpacedRepetition } from "@/lib/hooks/useSpacedRepetition";
import { SectionList } from "@/components/sections/SectionList";
import { normalizeContent } from "@/components/sections/sectionUtils";
import { formatRelativeFuture } from "@/lib/datetime";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, RotateCcw, BookOpen, BrainCircuit, ChevronDown, ChevronUp, Clock, Play, Menu, X } from "lucide-react";
import type { Neuron, SectionsDocument, ReviewQuestion, SpacedRepetitionItem } from "@/types";
import { cn } from "@/lib/utils";

const QUALITY_OPTIONS = [
  { label: "Again", quality: 1, color: "bg-red-500 hover:bg-red-600" },
  { label: "Hard", quality: 2, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Good", quality: 4, color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Easy", quality: 5, color: "bg-green-500 hover:bg-green-600" },
];

type ReviewMode = "choose" | "content" | "quiz";

function isDue(item: SpacedRepetitionItem): boolean {
  return new Date(item.nextReviewAt).getTime() <= Date.now();
}

export default function ReviewPage() {
  const router = useRouter();
  const { queue, queueLoading, allItems, itemsLoading, submitReview } = useSpacedRepetition();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [reviewingNonDue, setReviewingNonDue] = useState(false);
  const [neuron, setNeuron] = useState<Neuron | null>(null);
  const [sectionsDoc, setSectionsDoc] = useState<SectionsDocument | null>(null);
  const [loadingNeuron, setLoadingNeuron] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const richTextTextsRef = useRef<Map<string, string>>(new Map());

  // Quiz mode state
  const [reviewMode, setReviewMode] = useState<ReviewMode>("choose");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showQuizAnswers, setShowQuizAnswers] = useState(false);
  const [showFullNote, setShowFullNote] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  // Determine the active item: selected from sidebar or current in queue
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const activeItem: SpacedRepetitionItem | undefined = selectedItemId
    ? allItems.find((i) => i.id === selectedItemId)
    : queue[currentQueueIndex];
  const activeNeuronId = activeItem?.neuronId;
  const activeItemIsDue = activeItem ? isDue(activeItem) : false;
  const showingNonDueInfo = selectedItemId !== null && !activeItemIsDue && !reviewingNonDue;

  // Load neuron when active item changes
  useEffect(() => {
    if (!activeNeuronId) return;
    if (showingNonDueInfo) return; // Don't load neuron for non-due info display

    setLoadingNeuron(true);
    setShowAnswer(false);
    setNeuron(null);
    setSectionsDoc(null);
    setReviewMode("choose");
    setQuestions([]);
    setShowQuizAnswers(false);
    setShowFullNote(false);
    setUserAnswers({});

    api.get<Neuron>(`/api/neurons/${activeNeuronId}`).then((n) => {
      const parsedJson =
        typeof n.contentJson === "string"
          ? JSON.parse(n.contentJson)
          : n.contentJson;
      setNeuron({ ...n, contentJson: parsedJson });
      setSectionsDoc(normalizeContent(parsedJson));
      setLoadingNeuron(false);
    }).catch((err) => {
      console.error("Failed to load neuron for review:", activeNeuronId, err);
      setLoadingNeuron(false);
    });
  }, [activeNeuronId, showingNonDueInfo]);

  // Auto-select content mode if quiz not available
  useEffect(() => {
    if (activeItem && !loadingNeuron && neuron && !showingNonDueInfo) {
      if (!activeItem.quizEnabled || !activeItem.quizEligible || !activeItem.hasQuestions) {
        setReviewMode("content");
      }
    }
  }, [activeItem, loadingNeuron, neuron, showingNonDueInfo]);

  const handleSelectQuiz = async () => {
    if (!activeItem) return;
    setReviewMode("quiz");
    setLoadingQuestions(true);
    try {
      const qs = await api.spacedRepetition.getQuestions(activeItem.id);
      if (qs.length === 0) {
        setReviewMode("content");
      } else {
        setQuestions(qs);
      }
    } catch {
      setReviewMode("content");
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleRate = async (quality: number) => {
    if (!activeItem || submitting) return;
    setSubmitting(true);
    await submitReview(activeItem.id, quality);
    setSubmitting(false);

    if (selectedItemId) {
      // Was reviewing a specific item from sidebar
      setSelectedItemId(null);
      setReviewingNonDue(false);
      setNeuron(null);
      setSectionsDoc(null);
    } else if (currentQueueIndex < queue.length - 1) {
      setCurrentQueueIndex(currentQueueIndex + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleSelectItem = (item: SpacedRepetitionItem) => {
    setSelectedItemId(item.id);
    setReviewingNonDue(false);
    setCompleted(false);
    setNeuron(null);
    setSectionsDoc(null);
    setShowAnswer(false);
    setReviewMode("choose");
    setQuestions([]);
    setShowQuizAnswers(false);
    setShowFullNote(false);
    setUserAnswers({});
    setSidebarOpen(false);
  };

  const handleReviewNow = () => {
    setReviewingNonDue(true);
  };

  const handleBackToQueue = () => {
    setSelectedItemId(null);
    setReviewingNonDue(false);
  };

  if (queueLoading && itemsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noActiveItem = !activeItem && (queue.length === 0 || completed);

  const showRatingButtons = reviewMode === "content" ? showAnswer :
    reviewMode === "quiz" ? showQuizAnswers : false;

  // Sidebar content (shared between mobile overlay and desktop sidebar)
  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-sm">All Review Items</h3>
        <button className="sm:hidden h-6 w-6 flex items-center justify-center" onClick={() => setSidebarOpen(false)}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {itemsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : allItems.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No items in review</p>
        ) : (
          <div className="py-1">
            {allItems.map((item) => {
              const itemDue = isDue(item);
              const isActive = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-sm border-b transition-colors hover:bg-muted/50",
                    isActive && "bg-muted"
                  )}
                  data-testid={`sidebar-item-${item.id}`}
                >
                  <p className="font-medium truncate">{item.neuronTitle || "Untitled"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {itemDue ? (
                      <span className="text-xs font-medium text-purple-500">Due now</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-0.5" />
                        {formatRelativeFuture(item.nextReviewAt)}
                      </span>
                    )}
                    {item.quizEnabled && item.quizEligible && !item.hasQuestions && itemDue && (
                      <span className="text-xs text-orange-500">Generating quiz...</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full" data-testid="review-page">
      {/* Desktop sidebar */}
      <aside className="hidden sm:block w-64 border-r shrink-0 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <button className="sm:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5 text-muted-foreground" />
              </button>
              <h1 className="text-2xl font-bold">Review</h1>
            </div>
            <div className="flex items-center gap-2">
              {selectedItemId && (
                <Button variant="ghost" size="sm" onClick={handleBackToQueue} className="text-xs">
                  Back to queue
                </Button>
              )}
              {!selectedItemId && queue.length > 0 && !completed && (
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {currentQueueIndex + 1} / {queue.length}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Completed / empty state */}
          {noActiveItem && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h2 className="text-xl font-semibold">All caught up!</h2>
              <p className="text-muted-foreground text-sm">
                {completed
                  ? `You reviewed ${queue.length} item${queue.length !== 1 ? "s" : ""}.`
                  : "No neurons are due for review."}
              </p>
              {allItems.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  Select an item from the sidebar to review early.
                </p>
              )}
              <Button variant="outline" onClick={() => router.push("/")}>
                Back to Dashboard
              </Button>
            </div>
          )}

          {/* Non-due item info */}
          {showingNonDueInfo && activeItem && (
            <div className="border rounded-lg p-6 bg-card">
              <h2 className="text-xl font-semibold mb-4">{activeItem.neuronTitle || "Untitled"}</h2>
              <div className="flex flex-col items-center gap-4 py-8">
                <Clock className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  This item is not due for review yet.
                </p>
                <p className="text-lg font-medium">
                  Next review: <span className="text-purple-500">{formatRelativeFuture(activeItem.nextReviewAt)}</span>
                </p>
                <Button onClick={handleReviewNow} className="gap-2">
                  <Play className="h-4 w-4" />
                  Review Now
                </Button>
              </div>
            </div>
          )}

          {/* Active review card */}
          {activeItem && !noActiveItem && !showingNonDueInfo && (
            <>
              <div className="border rounded-lg p-6 mb-6 bg-card">
                {loadingNeuron ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : neuron && sectionsDoc ? (
                  <>
                    <h2 className="text-xl font-semibold mb-4">{neuron.title || "Untitled"}</h2>

                    {/* Mode chooser */}
                    {reviewMode === "choose" && (
                      <div className="flex justify-center gap-4 py-8" data-testid="mode-chooser">
                        <Button
                          size="lg"
                          variant="outline"
                          onClick={() => setReviewMode("content")}
                          className="flex items-center gap-2"
                          data-testid="mode-content"
                        >
                          <BookOpen className="h-5 w-5" />
                          Review Content
                        </Button>
                        {activeItem.quizEnabled && activeItem.quizEligible && (
                          <Button
                            size="lg"
                            onClick={activeItem.hasQuestions ? handleSelectQuiz : undefined}
                            disabled={!activeItem.hasQuestions}
                            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60"
                            data-testid="mode-quiz"
                          >
                            {!activeItem.hasQuestions ? (
                              <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Generating Quiz...
                              </>
                            ) : (
                              <>
                                <BrainCircuit className="h-5 w-5" />
                                Quiz Me
                                {activeItem.questionCount > 0 && (
                                  <span className="ml-1 text-xs bg-purple-500 rounded-full px-1.5 py-0.5">
                                    {activeItem.questionCount}
                                  </span>
                                )}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Content review mode */}
                    {reviewMode === "content" && (
                      <>
                        {!showAnswer ? (
                          <div className="text-center py-8">
                            <Button size="lg" onClick={() => setShowAnswer(true)} data-testid="show-answer-btn">
                              Show Content
                            </Button>
                          </div>
                        ) : (
                          <div className="border-t pt-4">
                            <SectionList
                              document={sectionsDoc}
                              onDocumentChange={() => {}}
                              richTextTextsRef={richTextTextsRef}
                              neuronId={activeItem.neuronId}
                              viewMode={true}
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Quiz mode */}
                    {reviewMode === "quiz" && (
                      <>
                        {loadingQuestions ? (
                          <div className="flex flex-col items-center gap-2 py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                            <p className="text-sm text-muted-foreground">Loading questions...</p>
                          </div>
                        ) : (
                          <div className="space-y-4" data-testid="quiz-questions">
                            {questions.map((q, i) => (
                              <div key={q.id} className="border rounded-md p-4">
                                <p className="font-medium text-sm text-muted-foreground mb-1">
                                  Question {i + 1} of {questions.length}
                                </p>
                                <p className="text-base">{q.questionText}</p>

                                {/* User answer textarea */}
                                <textarea
                                  className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground resize-y min-h-[60px]"
                                  placeholder="Type your answer here..."
                                  rows={3}
                                  value={userAnswers[q.id] || ""}
                                  onChange={(e) => setUserAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                  disabled={showQuizAnswers}
                                  data-testid={`user-answer-${i}`}
                                />

                                {showQuizAnswers && (
                                  <div className="mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-3" data-testid={`user-answer-display-${i}`}>
                                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Your Answer</p>
                                      <p className="text-base whitespace-pre-wrap">{userAnswers[q.id] || <em className="text-muted-foreground">No answer provided</em>}</p>
                                    </div>
                                    <div className="bg-green-50 dark:bg-green-950/30 rounded p-3" data-testid={`correct-answer-${i}`}>
                                      <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Correct Answer</p>
                                      <p className="text-base whitespace-pre-wrap">{q.answerText}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}

                            {!showQuizAnswers && (
                              <div className="text-center pt-4">
                                <Button
                                  size="lg"
                                  onClick={() => setShowQuizAnswers(true)}
                                  data-testid="show-quiz-answers-btn"
                                >
                                  Show Answers
                                </Button>
                              </div>
                            )}

                            {showQuizAnswers && (
                              <div className="border-t pt-4 mt-4">
                                <button
                                  onClick={() => setShowFullNote(!showFullNote)}
                                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                                  data-testid="toggle-full-note"
                                >
                                  {showFullNote ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  {showFullNote ? "Hide full note" : "Show full note"}
                                </button>
                                {showFullNote && (
                                  <div className="mt-3">
                                    <SectionList
                                      document={sectionsDoc}
                                      onDocumentChange={() => {}}
                                      richTextTextsRef={richTextTextsRef}
                                      neuronId={activeItem.neuronId}
                                      viewMode={true}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Failed to load neuron content.</p>
                )}
              </div>

              {showRatingButtons && (
                <div className="flex justify-center gap-3" data-testid="quality-buttons">
                  {QUALITY_OPTIONS.map((opt) => (
                    <Button
                      key={opt.quality}
                      onClick={() => handleRate(opt.quality)}
                      disabled={submitting}
                      className={`${opt.color} text-white min-w-[80px]`}
                      data-testid={`quality-${opt.quality}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

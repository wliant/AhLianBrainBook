"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSpacedRepetition } from "@/lib/hooks/useSpacedRepetition";
import { SectionList } from "@/components/sections/SectionList";
import { normalizeContent } from "@/components/sections/sectionUtils";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, RotateCcw, BookOpen, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react";
import type { Neuron, SectionsDocument, ReviewQuestion } from "@/types";
import { useRef } from "react";

const QUALITY_OPTIONS = [
  { label: "Again", quality: 1, color: "bg-red-500 hover:bg-red-600" },
  { label: "Hard", quality: 2, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Good", quality: 4, color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Easy", quality: 5, color: "bg-green-500 hover:bg-green-600" },
];

type ReviewMode = "choose" | "content" | "quiz";

export default function ReviewPage() {
  const router = useRouter();
  const { queue, queueLoading, submitReview } = useSpacedRepetition();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [neuron, setNeuron] = useState<Neuron | null>(null);
  const [sectionsDoc, setSectionsDoc] = useState<SectionsDocument | null>(null);
  const [loadingNeuron, setLoadingNeuron] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const richTextTextsRef = useRef<Map<string, string>>(new Map());

  // Quiz mode state
  const [reviewMode, setReviewMode] = useState<ReviewMode>("choose");
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showQuizAnswers, setShowQuizAnswers] = useState(false);
  const [showFullNote, setShowFullNote] = useState(false);

  const currentItem = queue[currentIndex];
  const currentNeuronId = currentItem?.neuronId;

  useEffect(() => {
    if (!currentNeuronId) return;

    setLoadingNeuron(true);
    setShowAnswer(false);
    setNeuron(null);
    setSectionsDoc(null);
    setReviewMode("choose");
    setQuestions([]);
    setShowQuizAnswers(false);
    setShowFullNote(false);

    api.get<Neuron>(`/api/neurons/${currentNeuronId}`).then((n) => {
      const parsedJson =
        typeof n.contentJson === "string"
          ? JSON.parse(n.contentJson)
          : n.contentJson;
      setNeuron({ ...n, contentJson: parsedJson });
      setSectionsDoc(normalizeContent(parsedJson));
      setLoadingNeuron(false);
    }).catch((err) => {
      console.error("Failed to load neuron for review:", currentNeuronId, err);
      setLoadingNeuron(false);
    });
  }, [currentNeuronId]);

  // Auto-select content mode if quiz not available
  useEffect(() => {
    if (currentItem && !loadingNeuron && neuron) {
      if (!currentItem.quizEligible || !currentItem.hasQuestions) {
        setReviewMode("content");
      }
    }
  }, [currentItem, loadingNeuron, neuron]);

  const handleSelectQuiz = async () => {
    if (!currentItem) return;
    setReviewMode("quiz");
    setLoadingQuestions(true);
    try {
      const qs = await api.spacedRepetition.getQuestions(currentItem.id);
      if (qs.length === 0) {
        // No questions ready, fall back to content mode
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
    if (!currentItem || submitting) return;
    setSubmitting(true);
    await submitReview(currentItem.id, quality);
    setSubmitting(false);

    if (currentIndex < queue.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCompleted(true);
    }
  };

  if (queueLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (queue.length === 0 || completed) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h2 className="text-xl font-semibold">All caught up!</h2>
        <p className="text-muted-foreground text-sm">
          {completed
            ? `You reviewed ${queue.length} item${queue.length !== 1 ? "s" : ""}.`
            : "No neurons are due for review."}
        </p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const showRatingButtons = reviewMode === "content" ? showAnswer :
    reviewMode === "quiz" ? showQuizAnswers : false;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto" data-testid="review-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Review</h1>
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>
      </div>

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
                <Button
                  size="lg"
                  onClick={handleSelectQuiz}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="mode-quiz"
                >
                  <BrainCircuit className="h-5 w-5" />
                  Quiz Me
                  {currentItem.questionCount > 0 && (
                    <span className="ml-1 text-xs bg-purple-500 rounded-full px-1.5 py-0.5">
                      {currentItem.questionCount}
                    </span>
                  )}
                </Button>
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
                      neuronId={currentItem.neuronId}
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
                        {showQuizAnswers && (
                          <div className="mt-3 pt-3 border-t bg-muted/50 rounded p-3" data-testid={`answer-${i}`}>
                            <p className="text-sm font-medium text-muted-foreground mb-1">Answer</p>
                            <p className="text-base">{q.answerText}</p>
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
                              neuronId={currentItem.neuronId}
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
    </div>
  );
}

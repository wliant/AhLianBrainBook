"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useSpacedRepetition } from "@/lib/hooks/useSpacedRepetition";
import { SectionList } from "@/components/sections/SectionList";
import { normalizeContent } from "@/components/sections/sectionUtils";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, RotateCcw } from "lucide-react";
import type { Neuron, SectionsDocument } from "@/types";
import { useRef } from "react";

const QUALITY_OPTIONS = [
  { label: "Again", quality: 1, color: "bg-red-500 hover:bg-red-600" },
  { label: "Hard", quality: 2, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Good", quality: 4, color: "bg-blue-500 hover:bg-blue-600" },
  { label: "Easy", quality: 5, color: "bg-green-500 hover:bg-green-600" },
];

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

  const currentItem = queue[currentIndex];

  const currentNeuronId = currentItem?.neuronId;

  useEffect(() => {
    if (!currentNeuronId) return;

    setLoadingNeuron(true);
    setShowAnswer(false);
    setNeuron(null);
    setSectionsDoc(null);

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
        ) : (
          <p className="text-muted-foreground text-center py-8">Failed to load neuron content.</p>
        )}
      </div>

      {showAnswer && (
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

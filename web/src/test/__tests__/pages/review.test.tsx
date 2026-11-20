import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { createWrapper } from '../../utils/createWrapper';
import type { SpacedRepetitionItem } from '@/types';

// Mock next/navigation (review page uses useRouter)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// The app issues relative URLs now - one origin serves both the UI and the
// API - so handlers must be registered against the page's own origin.
const API_BASE = window.location.origin;

const makeSRItem = (overrides: Partial<SpacedRepetitionItem> = {}): SpacedRepetitionItem => ({
  id: 'sr-1',
  neuronId: 'neuron-1',
  neuronTitle: 'Test Neuron',
  brainId: 'brain-1',
  clusterId: 'cluster-1',
  easeFactor: 2.5,
  intervalDays: 1,
  repetitions: 1,
  nextReviewAt: new Date().toISOString(),
  lastReviewedAt: null,
  createdAt: '2024-01-01T00:00:00',
  questionCount: 5,
  hasQuestions: true,
  quizEligible: true,
  quizEnabled: true,
  questionMode: "MIXED",
  ...overrides,
});

// Dynamic import so the next/navigation mock is applied before the module loads
const importReviewPage = async () => (await import('@/app/review/page')).default;

describe('Review page — regenerate questions', () => {
  it('shows a Regenerate button in the mode chooser and keeps the chooser when clicked (no switch to content)', async () => {
    let postCalled = false;
    let itemsCalls = 0;
    const dueItem = makeSRItem();
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/queue`, () => HttpResponse.json([dueItem])),
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => {
        itemsCalls++;
        // After regeneration starts, questions are stale (hasQuestions:false).
        return HttpResponse.json([makeSRItem({ hasQuestions: itemsCalls === 1 })]);
      }),
      http.get(`${API_BASE}/api/neurons/neuron-1`, () =>
        HttpResponse.json({ id: 'neuron-1', title: 'Test Neuron', contentJson: null })
      ),
      http.post(`${API_BASE}/api/spaced-repetition/items/:itemId/questions/regenerate`, () => {
        postCalled = true;
        return new HttpResponse(null, { status: 202 });
      })
    );

    const Wrapper = createWrapper();
    const ReviewPage = await importReviewPage();
    render(<Wrapper><ReviewPage /></Wrapper>);

    // Mode chooser appears once the neuron loads
    await waitFor(() => {
      expect(screen.getByTestId('mode-chooser')).toBeInTheDocument();
    });
    expect(screen.getByTestId('regenerate-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('regenerate-btn'));

    // POST fired and the generating indicator shows
    await waitFor(() => {
      expect(postCalled).toBe(true);
      expect(screen.getByTestId('regenerating-indicator')).toBeInTheDocument();
    });

    // Crucially, the chooser stays mounted — it must NOT auto-switch to content mode
    // even though hasQuestions is now false.
    expect(screen.getByTestId('mode-chooser')).toBeInTheDocument();
    expect(screen.queryByTestId('show-answer-btn')).not.toBeInTheDocument();
  });

  it('shows a Regenerate button on the not-due panel and triggers regeneration', async () => {
    let postCalled = false;
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const notDueItem = makeSRItem({ id: 'sr-2', neuronId: 'neuron-2', nextReviewAt: future });
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/queue`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => HttpResponse.json([notDueItem])),
      http.post(`${API_BASE}/api/spaced-repetition/items/:itemId/questions/regenerate`, () => {
        postCalled = true;
        return new HttpResponse(null, { status: 202 });
      })
    );

    const Wrapper = createWrapper();
    const ReviewPage = await importReviewPage();
    render(<Wrapper><ReviewPage /></Wrapper>);

    // Sidebar lists the not-due item; select it
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-item-sr-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('sidebar-item-sr-2'));

    // Not-due panel with the regenerate button
    await waitFor(() => {
      expect(screen.getByText(/not due for review yet/i)).toBeInTheDocument();
    });
    const regenBtn = screen.getByTestId('regenerate-btn');
    expect(regenBtn).toBeInTheDocument();

    fireEvent.click(regenBtn);

    await waitFor(() => {
      expect(postCalled).toBe(true);
      expect(screen.getByTestId('regenerating-indicator')).toBeInTheDocument();
    });
  });
});

describe('Review page — navigating to the neuron', () => {
  const HREF = '/brain/brain-1/cluster/cluster-1/neuron/neuron-1';

  const mountWithDueItem = async (item: SpacedRepetitionItem) => {
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/queue`, () => HttpResponse.json([item])),
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => HttpResponse.json([item])),
      http.get(`${API_BASE}/api/neurons/${item.neuronId}`, () =>
        HttpResponse.json({ id: item.neuronId, title: 'Test Neuron', contentJson: null })
      )
    );
    const Wrapper = createWrapper();
    const ReviewPage = await importReviewPage();
    render(<Wrapper><ReviewPage /></Wrapper>);
  };

  it('links each sidebar row to the neuron in a new tab without breaking selection', async () => {
    await mountWithDueItem(makeSRItem());

    const open = await screen.findByTestId('sidebar-item-open-sr-1');
    expect(open).toHaveAttribute('href', HREF);
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', expect.stringContaining('noopener'));

    // The row button is a sibling, not an ancestor — selecting the item still works.
    expect(screen.getByTestId('sidebar-item-sr-1')).not.toContainElement(open);
  });

  it('links the active item title to the neuron in a new tab', async () => {
    await mountWithDueItem(makeSRItem());

    const titleLink = await screen.findByTestId('active-item-open');
    expect(titleLink).toHaveAttribute('href', HREF);
    expect(titleLink).toHaveAttribute('target', '_blank');
    expect(titleLink).toHaveTextContent('Test Neuron');
  });

  it('renders the title as plain text when the neuron has no cluster', async () => {
    await mountWithDueItem(makeSRItem({ clusterId: null }));

    await waitFor(() => {
      expect(screen.getByTestId('mode-chooser')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('active-item-open')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-item-open-sr-1')).not.toBeInTheDocument();
    // Title still renders (sidebar row + heading), just unlinked.
    expect(screen.getAllByText('Test Neuron').length).toBeGreaterThan(0);
  });
});

describe('Review page — multiple-choice quiz', () => {
  const MC_QUESTIONS = [
    {
      id: 'q1',
      questionText: 'Which algorithm needs non-negative weights?',
      answerText: "Dijkstra's algorithm",
      questionOrder: 0,
      questionType: 'SINGLE_CHOICE',
      researched: true,
      explanation: 'Dijkstra settles vertices greedily.',
      choices: [
        { id: 'a', text: "Dijkstra's algorithm", correct: true, rationale: 'Greedy' },
        { id: 'b', text: 'Bellman-Ford', correct: false, rationale: 'Allows negative edges', sourceUrl: 'https://example.com/bf' },
        { id: 'c', text: 'Floyd-Warshall', correct: false },
      ],
    },
    {
      id: 'q2',
      questionText: 'Which are ACID properties?',
      answerText: 'Atomicity; Isolation',
      questionOrder: 1,
      questionType: 'MULTI_CHOICE',
      choices: [
        { id: 'a', text: 'Atomicity', correct: true },
        { id: 'b', text: 'Isolation', correct: true },
        { id: 'c', text: 'Elasticity', correct: false },
      ],
    },
    // No questionType at all: a pre-choices row must still render a textarea.
    {
      id: 'q3',
      questionText: 'Why are non-negative weights required?',
      answerText: 'Because the greedy choice must stay valid.',
      questionOrder: 2,
    },
  ];

  const setupQuiz = (questions: unknown[] = MC_QUESTIONS) => {
    const dueItem = makeSRItem({ hasQuestions: true, quizEligible: true, quizEnabled: true });
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/queue`, () => HttpResponse.json([dueItem])),
      http.get(`${API_BASE}/api/spaced-repetition/items`, () => HttpResponse.json([dueItem])),
      http.get(`${API_BASE}/api/neurons/neuron-1`, () =>
        HttpResponse.json({ id: 'neuron-1', title: 'Test Neuron', contentJson: null })
      ),
      http.get(`${API_BASE}/api/spaced-repetition/items/:itemId/questions`, () =>
        HttpResponse.json(questions)
      )
    );
  };

  const enterQuiz = async () => {
    const ReviewPage = await importReviewPage();
    render(<ReviewPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByTestId('mode-quiz')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mode-quiz'));
    await waitFor(() => expect(screen.getByTestId('quiz-questions')).toBeInTheDocument());
  };

  it('renders radios, checkboxes and a textarea for a mixed question set', async () => {
    setupQuiz();
    await enterQuiz();

    expect(screen.getByTestId('choice-input-0-a')).toHaveAttribute('type', 'radio');
    expect(screen.getByTestId('choice-input-1-a')).toHaveAttribute('type', 'checkbox');
    // The untyped legacy question falls back to free text.
    expect(screen.getByTestId('user-answer-2')).toBeInTheDocument();
  });

  it('scores an all-correct run and suggests the Easy rating', async () => {
    setupQuiz();
    await enterQuiz();

    fireEvent.click(screen.getByTestId('choice-input-0-a'));
    fireEvent.click(screen.getByTestId('choice-input-1-a'));
    fireEvent.click(screen.getByTestId('choice-input-1-b'));
    fireEvent.click(screen.getByTestId('show-quiz-answers-btn'));

    await waitFor(() => expect(screen.getByTestId('quiz-score')).toBeInTheDocument());
    expect(screen.getByTestId('quiz-score')).toHaveTextContent('2 / 2 correct');
    expect(screen.getByTestId('quiz-score')).toHaveTextContent('1 self-assessed');
    expect(screen.getByTestId('quality-5')).toHaveAttribute('data-suggested', 'true');
  });

  it('treats a partial multi-select as incorrect', async () => {
    setupQuiz();
    await enterQuiz();

    fireEvent.click(screen.getByTestId('choice-input-0-a'));
    fireEvent.click(screen.getByTestId('choice-input-1-a')); // only one of two correct
    fireEvent.click(screen.getByTestId('show-quiz-answers-btn'));

    await waitFor(() => expect(screen.getByTestId('choice-verdict-1')).toBeInTheDocument());
    expect(screen.getByTestId('choice-verdict-0')).toHaveTextContent('Correct');
    expect(screen.getByTestId('choice-verdict-1')).toHaveTextContent('Incorrect');
    expect(screen.getByTestId('quiz-score')).toHaveTextContent('1 / 2 correct');
  });

  it('lets a multi-select option be deselected', async () => {
    setupQuiz();
    await enterQuiz();

    fireEvent.click(screen.getByTestId('choice-input-1-c'));
    expect(screen.getByTestId('choice-input-1-c')).toBeChecked();
    fireEvent.click(screen.getByTestId('choice-input-1-c'));
    expect(screen.getByTestId('choice-input-1-c')).not.toBeChecked();
  });

  it('replaces the selection for single select', async () => {
    setupQuiz();
    await enterQuiz();

    fireEvent.click(screen.getByTestId('choice-input-0-a'));
    fireEvent.click(screen.getByTestId('choice-input-0-b'));
    expect(screen.getByTestId('choice-input-0-a')).not.toBeChecked();
    expect(screen.getByTestId('choice-input-0-b')).toBeChecked();
  });

  it('reveals rationales, explanation and source links', async () => {
    setupQuiz();
    await enterQuiz();

    fireEvent.click(screen.getByTestId('show-quiz-answers-btn'));
    await waitFor(() => expect(screen.getByTestId('choice-explanation-0')).toBeInTheDocument());

    expect(screen.getByText('Allows negative edges')).toBeInTheDocument();
    expect(screen.getByTestId('choice-source-0-b')).toHaveAttribute('href', 'https://example.com/bf');
    expect(screen.getByTestId('choice-researched-0')).toBeInTheDocument();
  });

  it('suggests Again when everything is wrong', async () => {
    setupQuiz();
    await enterQuiz();

    fireEvent.click(screen.getByTestId('choice-input-0-b'));
    fireEvent.click(screen.getByTestId('choice-input-1-c'));
    fireEvent.click(screen.getByTestId('show-quiz-answers-btn'));

    await waitFor(() => expect(screen.getByTestId('quiz-score')).toBeInTheDocument());
    expect(screen.getByTestId('quiz-score')).toHaveTextContent('0 / 2 correct');
    expect(screen.getByTestId('quality-1')).toHaveAttribute('data-suggested', 'true');
  });

  it('shows no score or suggestion for a free-text-only set', async () => {
    setupQuiz([MC_QUESTIONS[2]]);
    await enterQuiz();

    fireEvent.click(screen.getByTestId('show-quiz-answers-btn'));
    await waitFor(() => expect(screen.getByTestId('quality-buttons')).toBeInTheDocument());

    expect(screen.queryByTestId('quiz-score')).not.toBeInTheDocument();
    expect(screen.getByTestId('quality-5')).not.toHaveAttribute('data-suggested');
  });

  it('renders a choice-typed question with no options as free text', async () => {
    setupQuiz([{ ...MC_QUESTIONS[0], choices: [] }]);
    await enterQuiz();

    expect(screen.queryByTestId('choice-question-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-answer-0')).toBeInTheDocument();
  });
});

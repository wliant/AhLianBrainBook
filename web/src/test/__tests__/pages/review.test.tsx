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

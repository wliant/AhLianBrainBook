import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { SpacedRepetitionPanel } from '@/components/neuron/SpacedRepetitionPanel';
import { server } from '../../../mocks/server';

const API_BASE = 'http://localhost:8080';

// Use 3.5 days to avoid edge rounding issues in tests
const makeSRItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'sr-1',
  neuronId: 'neuron-1',
  neuronTitle: 'Test Neuron',
  easeFactor: 2.5,
  intervalDays: 6,
  repetitions: 2,
  nextReviewAt: new Date(Date.now() + 3.5 * 24 * 3600_000).toISOString(),
  lastReviewedAt: new Date(Date.now() - 2 * 24 * 3600_000).toISOString(),
  createdAt: '2024-01-01T00:00:00',
  questionCount: 5,
  hasQuestions: false,
  quizEligible: false,
  quizEnabled: true,
  ...overrides,
});

const defaultProps = {
  neuronId: 'neuron-1',
  onClose: vi.fn(),
  addToReview: vi.fn().mockResolvedValue(undefined),
  removeFromReview: vi.fn().mockResolvedValue(undefined),
};

describe('SpacedRepetitionPanel', () => {
  it('renders panel with correct header', async () => {
    render(<SpacedRepetitionPanel {...defaultProps} />);

    expect(screen.getByTestId('sr-panel')).toBeInTheDocument();
    expect(screen.getByText('Spaced Repetition')).toBeInTheDocument();
  });

  it('renders empty state when not in review (404)', async () => {
    // Default handler returns 404, so no need to override
    render(<SpacedRepetitionPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/not in your review queue/)).toBeInTheDocument();
    });

    expect(screen.getByTestId('sr-add-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('sr-remove-btn')).not.toBeInTheDocument();
  });

  it('renders in-review state with details', async () => {
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        HttpResponse.json(makeSRItem())
      )
    );

    render(<SpacedRepetitionPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Next review')).toBeInTheDocument();
    });

    expect(screen.getByText(/in 3 day/)).toBeInTheDocument();
    expect(screen.getByText('2.50')).toBeInTheDocument();
    expect(screen.getByText(/6 day/)).toBeInTheDocument();
    expect(screen.getByTestId('sr-remove-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('sr-add-btn')).not.toBeInTheDocument();
  });

  it('clicking Add to Review calls addToReview prop', async () => {
    const addToReview = vi.fn().mockResolvedValue(undefined);
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        new HttpResponse(null, { status: 404 })
      )
    );

    render(<SpacedRepetitionPanel {...defaultProps} addToReview={addToReview} />);

    await waitFor(() => {
      expect(screen.getByTestId('sr-add-btn')).toBeInTheDocument();
    });

    const user = userEvent.setup();

    // Set up the GET handler to return an item after add
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        HttpResponse.json(makeSRItem())
      )
    );

    await user.click(screen.getByTestId('sr-add-btn'));

    expect(addToReview).toHaveBeenCalledWith('neuron-1');
  });

  it('clicking Remove from Review calls removeFromReview prop', async () => {
    const removeFromReview = vi.fn().mockResolvedValue(undefined);
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        HttpResponse.json(makeSRItem())
      )
    );

    render(<SpacedRepetitionPanel {...defaultProps} removeFromReview={removeFromReview} />);

    await waitFor(() => {
      expect(screen.getByTestId('sr-remove-btn')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('sr-remove-btn'));

    expect(removeFromReview).toHaveBeenCalledWith('neuron-1');
  });

  it('clicking close calls onClose', async () => {
    const onClose = vi.fn();
    render(<SpacedRepetitionPanel {...defaultProps} onClose={onClose} />);

    const user = userEvent.setup();
    const closeButton = screen.getByTestId('sr-panel').querySelector('.border-b button') as HTMLElement;
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows error state when add fails', async () => {
    const addToReview = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<SpacedRepetitionPanel {...defaultProps} addToReview={addToReview} />);

    await waitFor(() => {
      expect(screen.getByTestId('sr-add-btn')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByTestId('sr-add-btn'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows "Now" when next review is due', async () => {
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        HttpResponse.json(makeSRItem({
          nextReviewAt: new Date(Date.now() - 3600_000).toISOString(),
        }))
      )
    );

    render(<SpacedRepetitionPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Now')).toBeInTheDocument();
    });
  });

  it('shows "Never" when lastReviewedAt is null', async () => {
    server.use(
      http.get(`${API_BASE}/api/spaced-repetition/items/:neuronId`, () =>
        HttpResponse.json(makeSRItem({ lastReviewedAt: null }))
      )
    );

    render(<SpacedRepetitionPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });
});

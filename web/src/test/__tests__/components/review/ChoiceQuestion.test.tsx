import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChoiceQuestion } from '@/components/review/ChoiceQuestion';
import type { ReviewQuestion } from '@/types';

const singleQuestion: ReviewQuestion = {
  id: 'q1',
  questionText: 'Which algorithm needs non-negative weights?',
  answerText: "Dijkstra's algorithm",
  questionOrder: 0,
  questionType: 'SINGLE_CHOICE',
  explanation: 'Dijkstra is greedy, so a negative edge could invalidate a settled vertex.',
  researched: true,
  choices: [
    { id: 'a', text: "Dijkstra's algorithm", correct: true, rationale: 'Greedy and needs non-negative weights' },
    { id: 'b', text: 'Bellman-Ford', correct: false, rationale: 'Tolerates negative edges', sourceUrl: 'https://example.com/bellman-ford' },
    { id: 'c', text: 'Floyd-Warshall', correct: false },
  ],
};

const multiQuestion: ReviewQuestion = {
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
};

const renderQuestion = (props: Partial<Parameters<typeof ChoiceQuestion>[0]> = {}) =>
  render(
    <ChoiceQuestion
      question={singleQuestion}
      index={0}
      total={3}
      selected={[]}
      revealed={false}
      onToggle={vi.fn()}
      {...props}
    />
  );

describe('ChoiceQuestion', () => {
  it('renders radio inputs for single select', () => {
    renderQuestion();
    expect(screen.getByTestId('choice-input-0-a')).toHaveAttribute('type', 'radio');
    expect(screen.getByText('Select one')).toBeInTheDocument();
  });

  it('renders checkbox inputs for multi select', () => {
    renderQuestion({ question: multiQuestion });
    expect(screen.getByTestId('choice-input-0-a')).toHaveAttribute('type', 'checkbox');
    expect(screen.getByText('Select all that apply')).toBeInTheDocument();
  });

  it('reports the clicked option id', async () => {
    const onToggle = vi.fn();
    renderQuestion({ onToggle });
    await userEvent.click(screen.getByTestId('choice-input-0-b'));
    expect(onToggle).toHaveBeenCalledWith('b');
  });

  it('shows the question position', () => {
    renderQuestion({ index: 1, total: 4 });
    expect(screen.getByText('Question 2 of 4')).toBeInTheDocument();
  });

  it('badges a web-researched question', () => {
    renderQuestion();
    expect(screen.getByTestId('choice-researched-0')).toBeInTheDocument();
  });

  it('omits the badge when research did not run', () => {
    renderQuestion({ question: { ...singleQuestion, researched: false } });
    expect(screen.queryByTestId('choice-researched-0')).not.toBeInTheDocument();
  });

  describe('before reveal', () => {
    it('hides verdict, rationale and explanation', () => {
      renderQuestion({ selected: ['a'] });
      expect(screen.queryByTestId('choice-verdict-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('choice-explanation-0')).not.toBeInTheDocument();
      expect(screen.queryByText('Tolerates negative edges')).not.toBeInTheDocument();
    });

    it('leaves inputs enabled', () => {
      renderQuestion();
      expect(screen.getByTestId('choice-input-0-a')).toBeEnabled();
    });
  });

  describe('after reveal', () => {
    it('marks a correct answer', () => {
      renderQuestion({ selected: ['a'], revealed: true });
      expect(screen.getByTestId('choice-verdict-0')).toHaveTextContent('Correct');
    });

    it('marks a wrong answer', () => {
      renderQuestion({ selected: ['b'], revealed: true });
      expect(screen.getByTestId('choice-verdict-0')).toHaveTextContent('Incorrect');
    });

    it('marks a partial multi-select as incorrect', () => {
      renderQuestion({ question: multiQuestion, selected: ['a'], revealed: true });
      expect(screen.getByTestId('choice-verdict-0')).toHaveTextContent('Incorrect');
    });

    it('disables every input', () => {
      renderQuestion({ revealed: true });
      expect(screen.getByTestId('choice-input-0-a')).toBeDisabled();
      expect(screen.getByTestId('choice-input-0-b')).toBeDisabled();
    });

    it('shows per-option rationales and the explanation', () => {
      renderQuestion({ selected: ['b'], revealed: true });
      expect(screen.getByText('Tolerates negative edges')).toBeInTheDocument();
      expect(screen.getByTestId('choice-explanation-0')).toHaveTextContent('Dijkstra is greedy');
    });

    it('links a distractor to its source by hostname', () => {
      renderQuestion({ revealed: true });
      const link = screen.getByTestId('choice-source-0-b');
      expect(link).toHaveAttribute('href', 'https://example.com/bellman-ford');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveTextContent('example.com');
    });

    it('omits a source link for an option without one', () => {
      renderQuestion({ revealed: true });
      expect(screen.queryByTestId('choice-source-0-c')).not.toBeInTheDocument();
    });

    it('highlights the correct option even when it was not selected', () => {
      renderQuestion({ selected: ['b'], revealed: true });
      expect(screen.getByTestId('choice-option-0-a').className).toContain('border-green-500');
      expect(screen.getByTestId('choice-option-0-b').className).toContain('border-red-500');
    });
  });
});

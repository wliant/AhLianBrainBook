import { describe, it, expect } from 'vitest';
import type { ReviewQuestion, ReviewChoice } from '@/types';
import {
  applySelection,
  correctIds,
  gradeQuestion,
  gradeQuiz,
  isChoiceQuestion,
  isMultiSelect,
  suggestQuality,
} from '@/lib/reviewGrading';

const choice = (id: string, correct = false): ReviewChoice => ({ id, text: `Option ${id}`, correct });

const single = (overrides: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  id: 'q-single',
  questionText: 'Pick one',
  answerText: 'Option a',
  questionOrder: 0,
  questionType: 'SINGLE_CHOICE',
  choices: [choice('a', true), choice('b'), choice('c'), choice('d')],
  ...overrides,
});

const multi = (overrides: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  id: 'q-multi',
  questionText: 'Pick all that apply',
  answerText: 'Option a; Option b',
  questionOrder: 1,
  questionType: 'MULTI_CHOICE',
  choices: [choice('a', true), choice('b', true), choice('c'), choice('d'), choice('e')],
  ...overrides,
});

const freeText = (overrides: Partial<ReviewQuestion> = {}): ReviewQuestion => ({
  id: 'q-free',
  questionText: 'Explain why',
  answerText: 'Because.',
  questionOrder: 2,
  ...overrides,
});

describe('isChoiceQuestion', () => {
  it('accepts a choice question with options', () => {
    expect(isChoiceQuestion(single())).toBe(true);
    expect(isChoiceQuestion(multi())).toBe(true);
  });

  it('rejects a legacy question with no type', () => {
    expect(isChoiceQuestion(freeText())).toBe(false);
  });

  it('rejects a choice type with no options, so a malformed row degrades to a textarea', () => {
    expect(isChoiceQuestion(single({ choices: [] }))).toBe(false);
    expect(isChoiceQuestion(single({ choices: null }))).toBe(false);
    expect(isChoiceQuestion(single({ choices: undefined }))).toBe(false);
  });

  it('identifies multi-select only for MULTI_CHOICE', () => {
    expect(isMultiSelect(multi())).toBe(true);
    expect(isMultiSelect(single())).toBe(false);
  });
});

describe('correctIds', () => {
  it('returns every correct option id', () => {
    expect(correctIds(multi())).toEqual(['a', 'b']);
  });

  it('is empty when there are no choices', () => {
    expect(correctIds(freeText())).toEqual([]);
  });
});

describe('gradeQuestion — single select', () => {
  it('marks the right option correct', () => {
    expect(gradeQuestion(single(), ['a'])).toBe('correct');
  });

  it('marks a wrong option incorrect', () => {
    expect(gradeQuestion(single(), ['b'])).toBe('incorrect');
  });

  it('marks no selection incorrect', () => {
    expect(gradeQuestion(single(), [])).toBe('incorrect');
    expect(gradeQuestion(single(), undefined)).toBe('incorrect');
  });
});

describe('gradeQuestion — multi select is exact set match', () => {
  it('accepts the exact set regardless of order', () => {
    expect(gradeQuestion(multi(), ['b', 'a'])).toBe('correct');
  });

  it('rejects a subset — no partial credit', () => {
    expect(gradeQuestion(multi(), ['a'])).toBe('incorrect');
  });

  it('rejects a superset', () => {
    expect(gradeQuestion(multi(), ['a', 'b', 'c'])).toBe('incorrect');
  });

  it('rejects a disjoint set', () => {
    expect(gradeQuestion(multi(), ['c', 'd'])).toBe('incorrect');
  });

  it('rejects a same-sized wrong set', () => {
    expect(gradeQuestion(multi(), ['a', 'c'])).toBe('incorrect');
  });

  it('ignores duplicate selections', () => {
    expect(gradeQuestion(multi(), ['a', 'b', 'b'])).toBe('correct');
  });
});

describe('gradeQuestion — free text', () => {
  it('is never machine-graded', () => {
    expect(gradeQuestion(freeText(), undefined)).toBe('ungraded');
  });
});

describe('gradeQuiz', () => {
  it('counts graded and self-assessed questions separately', () => {
    const score = gradeQuiz([single(), multi(), freeText()], {
      'q-single': ['a'],
      'q-multi': ['a'],
    });
    expect(score).toEqual({
      gradedCount: 2,
      correctCount: 1,
      selfAssessedCount: 1,
      ratio: 0.5,
    });
  });

  it('reports a zero ratio when nothing is gradable', () => {
    const score = gradeQuiz([freeText()], {});
    expect(score.gradedCount).toBe(0);
    expect(score.ratio).toBe(0);
  });
});

describe('suggestQuality', () => {
  const score = (correctCount: number, gradedCount: number) => ({
    gradedCount,
    correctCount,
    selfAssessedCount: 0,
    ratio: gradedCount === 0 ? 0 : correctCount / gradedCount,
  });

  it('returns null when nothing was machine-graded', () => {
    expect(suggestQuality(score(0, 0))).toBeNull();
  });

  it('maps onto the page quality values', () => {
    expect(suggestQuality(score(10, 10))).toBe(5); // Easy
    expect(suggestQuality(score(8, 10))).toBe(4);  // Good
    expect(suggestQuality(score(5, 10))).toBe(2);  // Hard
    expect(suggestQuality(score(1, 10))).toBe(1);  // Again
  });
});

describe('applySelection', () => {
  it('replaces the selection for single select', () => {
    expect(applySelection(single(), ['a'], 'b')).toEqual(['b']);
  });

  it('adds to the selection for multi select', () => {
    expect(applySelection(multi(), ['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes an already-selected option for multi select', () => {
    expect(applySelection(multi(), ['a', 'b'], 'a')).toEqual(['b']);
  });

  it('handles an undefined starting selection', () => {
    expect(applySelection(multi(), undefined, 'a')).toEqual(['a']);
  });
});

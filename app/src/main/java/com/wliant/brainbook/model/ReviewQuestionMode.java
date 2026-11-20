package com.wliant.brainbook.model;

/**
 * Per-item policy for which question formats a review quiz may contain.
 *
 * <p>Distinct from {@link ReviewQuestionType}, which describes one generated question.
 */
public enum ReviewQuestionMode {
    /** Free-text recall only; no choice questions are generated. */
    FREE_TEXT,
    /** The generator picks the format per question. */
    MIXED,
    /** Only choice questions are kept; a question that cannot be one is dropped. */
    CHOICE_ONLY;

    /** True when choice questions are wanted at all. */
    public boolean allowsChoiceQuestions() {
        return this != FREE_TEXT;
    }
}

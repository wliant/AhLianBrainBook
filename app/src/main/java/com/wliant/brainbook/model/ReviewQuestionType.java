package com.wliant.brainbook.model;

public enum ReviewQuestionType {
    /** Free-text recall; graded by the reviewer, not the app. */
    FREE_TEXT,
    /** Multiple choice with exactly one correct option. */
    SINGLE_CHOICE,
    /** Multiple choice with more than one correct option; graded on exact set match. */
    MULTI_CHOICE
}

package com.wliant.brainbook.dto;

/**
 * One option of a multiple-choice review question.
 *
 * <p>{@code rationale} explains why the option is right or wrong; {@code sourceUrl} points at
 * the researched fact a distractor was built from. Both are optional.
 */
public record ReviewChoice(
        String id,
        String text,
        boolean correct,
        String rationale,
        String sourceUrl
) {
}

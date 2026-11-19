package com.wliant.brainbook.dto;

import com.wliant.brainbook.model.ReviewQuestionType;

import java.util.List;
import java.util.UUID;

public record ReviewQuestionResponse(
        UUID id,
        String questionText,
        String answerText,
        int questionOrder,
        ReviewQuestionType questionType,
        List<ReviewChoice> choices,
        String explanation,
        boolean researched
) {
}

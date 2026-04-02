package com.wliant.brainbook.dto;

import java.util.UUID;

public record ReviewQuestionResponse(
        UUID id,
        String questionText,
        String answerText,
        int questionOrder
) {
}

package com.wliant.brainbook.dto;

import java.util.List;
import java.util.Map;

public record AiAssistRequest(
        String sectionType,
        Map<String, Object> currentContent,
        String userMessage,
        List<ConversationTurn> conversationHistory,
        List<QuestionAnswer> questionAnswers,
        boolean regenerate
) {

    public record ConversationTurn(
            String role,
            Map<String, Object> content
    ) {
    }

    public record QuestionAnswer(
            String questionId,
            Object value
    ) {
    }
}

package com.wliant.brainbook.dto;

import java.util.List;
import java.util.Map;

public record AiAssistResponse(
        String responseType,
        List<QuestionItem> questions,
        Map<String, Object> sectionContent,
        String message,
        String messageSeverity,
        String explanation,
        List<AiAssistRequest.ConversationTurn> conversationHistory
) {

    public record QuestionItem(
            String id,
            String text,
            String inputType,
            List<String> options,
            boolean required
    ) {
    }
}

package com.wliant.brainbook.dto;

import java.time.LocalDateTime;
import java.util.UUID;

public record LinkSuggestionResponse(
    UUID id,
    UUID sourceNeuronId,
    String sourceNeuronTitle,
    UUID sourceNeuronClusterId,
    UUID targetNeuronId,
    String targetNeuronTitle,
    UUID targetNeuronClusterId,
    String suggestionType,
    String displayType,
    Double score,
    LocalDateTime createdAt
) { }

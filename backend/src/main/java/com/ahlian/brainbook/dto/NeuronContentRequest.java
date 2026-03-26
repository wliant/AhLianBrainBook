package com.ahlian.brainbook.dto;

public record NeuronContentRequest(
        String contentJson,
        String contentText,
        int clientVersion
) {
}

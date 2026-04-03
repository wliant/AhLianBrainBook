package com.wliant.brainbook.dto;

import java.time.LocalDateTime;

public record BlameLineResponse(
        int line,
        String commitSha,
        String author,
        LocalDateTime date,
        String content
) {
}

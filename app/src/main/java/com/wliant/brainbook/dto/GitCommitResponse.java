package com.wliant.brainbook.dto;

import java.time.LocalDateTime;

public record GitCommitResponse(
        String sha,
        String author,
        String authorEmail,
        LocalDateTime date,
        String message
) {
}
